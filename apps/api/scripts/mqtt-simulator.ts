import mqtt from 'mqtt';

const url = process.env.MQTT_URL ?? 'mqtt://localhost:1883';
const topic = process.env.MQTT_TOPIC ?? 'campus/d2/d2-101/env';
const intervalMs = Number(process.env.MQTT_SIM_INTERVAL_MS ?? 5000);
const stress = process.env.MQTT_SIM_STRESS === '1';

const client = mqtt.connect(url);

function tick() {
  const t = Date.now() / 60_000;
  const payload = {
    temperature: Number((stress ? 28.4 + Math.random() : 21.6 + Math.sin(t) * 2.1).toFixed(1)),
    humidity: Number((48 + Math.sin(t / 2) * 4 + Math.random()).toFixed(1)),
    co2: Math.round(stress ? 1040 + Math.random() * 50 : 540 + Math.sin(t / 3) * 70 + Math.random() * 20),
    rssi: Math.round(-62 + Math.random() * 8),
    battery: 86,
    occupancy: stress ? 18 : 12,
    people: stress ? 18 : 12,
  };

  client.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
    if (err) {
      console.error('[iot-sim] publicação falhou', err.message);
      return;
    }
    console.log(
      `[iot-sim] ${topic} · ${payload.temperature} °C · ${payload.humidity}% · ${payload.co2} ppm`,
    );
  });
}

client.on('connect', () => {
  console.log(`[iot-sim] ligado a ${url}`);
  tick();
  setInterval(tick, intervalMs);
});

client.on('error', (err) => {
  console.error('[iot-sim] erro', err.message);
});
