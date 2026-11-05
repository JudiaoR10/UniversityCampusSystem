import mqtt from 'mqtt';
import { prisma } from '../../../lib/prisma.js';
import { getEnv } from '../../../config/env.js';
import { raiseDeviceAlert, raiseMetricAlert } from '../../devices/application/alertService.js';

const WATCHDOG_EVERY_MS = 30_000;
const REFRESH_TOPICS_EVERY_MS = 60_000;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** RSSI (dBm) -> percentagem aproximada: -100 dBm = 0 %, -50 dBm = 100 %. */
const rssiToPercent = (rssi: number) => Math.round(clamp(2 * (rssi + 100), 0, 100));

let mqttConnected = false;
let mqttUrl = 'mqtt://localhost:1883';

export function getMqttStatus() {
  return { connected: mqttConnected, url: mqttUrl };
}

export function startMqttIngest() {
  const env = getEnv();
  mqttUrl = env.MQTT_URL;
  const offlineAfterMs = env.DEVICE_OFFLINE_AFTER_MS;
  const client = mqtt.connect(mqttUrl);
  const topicToDevice = new Map<string, string>();

  async function refreshSubscriptions() {
    const devices = await prisma.device.findMany({
      where: { mqttTopic: { not: null } },
      select: { id: true, mqttTopic: true },
    });

    const wanted = new Map(devices.map((d) => [d.mqttTopic as string, d.id]));

    for (const [topic] of topicToDevice) {
      if (!wanted.has(topic)) {
        client.unsubscribe(topic);
        topicToDevice.delete(topic);
      }
    }
    for (const [topic, id] of wanted) {
      if (!topicToDevice.has(topic)) {
        client.subscribe(topic);
      }
      topicToDevice.set(topic, id);
    }
  }

  async function handleMessage(topic: string, raw: Buffer) {
    const deviceId = topicToDevice.get(topic);
    if (!deviceId) return;

    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw.toString('utf8'));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return;
      payload = parsed as Record<string, unknown>;
    } catch {
      console.warn(`[mqtt] payload inválido em ${topic}`);
      return;
    }

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: { sensors: true },
    });
    if (!device) return;

    const readings = device.sensors.flatMap((s) => {
      const value = payload[s.metric];
      return isNum(value) ? [{ sensor: s, value }] : [];
    });

    const signal = isNum(payload.rssi)
      ? rssiToPercent(payload.rssi)
      : isNum(payload.signal)
        ? Math.round(clamp(payload.signal, 0, 100))
        : undefined;
    const battery = isNum(payload.battery) ? Math.round(clamp(payload.battery, 0, 100)) : undefined;

    await prisma.$transaction(async (tx) => {
      if (readings.length > 0) {
        await tx.reading.createMany({
          data: readings.map((r) => ({ sensorId: r.sensor.id, value: r.value, isDemo: false })),
        });
      }

      await tx.device.update({
        where: { id: device.id },
        data: {
          lastSeenAt: new Date(),
          ...(signal !== undefined ? { signal } : {}),
          ...(battery !== undefined ? { battery } : {}),
        },
      });

      const res = await tx.device.updateMany({
        where: { id: device.id, status: { in: ['OFFLINE', 'UNKNOWN'] } },
        data: { status: 'ONLINE' },
      });
      if (res.count > 0) await raiseDeviceAlert(tx, device, device.status, 'ONLINE');

      for (const reading of readings) {
        await raiseMetricAlert(tx, reading.sensor, reading.value);
      }
    });
  }

  async function pruneReadings() {
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key: 'readingRetentionDays' } });
      const days = Number(setting?.value ?? 30);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      await prisma.reading.deleteMany({ where: { recordedAt: { lt: cutoff } } });
    } catch (err) {
      console.error('[mqtt] retenção falhou', err);
    }
  }

  async function watchdog() {
    const cutoff = new Date(Date.now() - offlineAfterMs);
    const stale = await prisma.device.findMany({
      where: { status: 'ONLINE', lastSeenAt: { lt: cutoff } },
    });

    for (const device of stale) {
      await prisma.$transaction(async (tx) => {
        const res = await tx.device.updateMany({
          where: { id: device.id, status: 'ONLINE' },
          data: { status: 'OFFLINE' },
        });
        if (res.count > 0) await raiseDeviceAlert(tx, device, 'ONLINE', 'OFFLINE');
      });
    }
  }

  client.on('connect', () => {
    mqttConnected = true;
    console.log(`[mqtt] ligado a ${mqttUrl}`);
    refreshSubscriptions().catch((e) => console.error('[mqtt] refresh falhou', e));
  });
  client.on('reconnect', () => {
    mqttConnected = client.connected;
  });
  client.on('offline', () => {
    mqttConnected = false;
  });
  client.on('close', () => {
    mqttConnected = false;
  });
  client.on('error', (e) => {
    mqttConnected = client.connected;
    console.error('[mqtt] erro', e.message);
  });
  client.on('message', (topic, raw) => {
    handleMessage(topic, raw).catch((e) => console.error('[mqtt] mensagem falhou', e));
  });

  const refreshTimer = setInterval(() => {
    if (client.connected) refreshSubscriptions().catch((e) => console.error('[mqtt] refresh falhou', e));
  }, REFRESH_TOPICS_EVERY_MS);
  const watchdogTimer = setInterval(() => {
    watchdog().catch((e) => console.error('[mqtt] watchdog falhou', e));
  }, WATCHDOG_EVERY_MS);
  const pruneTimer = setInterval(() => {
    pruneReadings().catch((e) => console.error('[mqtt] retenção falhou', e));
  }, 60 * 60 * 1000);

  return () => {
    mqttConnected = false;
    clearInterval(refreshTimer);
    clearInterval(watchdogTimer);
    clearInterval(pruneTimer);
    client.end();
  };
}
