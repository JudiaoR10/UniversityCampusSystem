const apiBase = process.env.API_URL ?? 'http://localhost:4100/api/v1';
const token = process.env.INGEST_API_KEY ?? process.env.LPR_DEVICE_TOKEN ?? 'dev-lpr-cam-01';
const lotCode = process.env.LPR_LOT_CODE ?? 'PARK-B';
const intervalMs = Number(process.env.LPR_SIM_INTERVAL_MS ?? 8000);

const plates = ['AIT 954 MC', 'AMH 722 MP', 'MLY 72 22', 'ABR 301 MC', 'ADP 448 MP', 'AHK 883 MC'];

async function tick() {
  const plate = plates[Math.floor(Math.random() * plates.length)];
  const direction = Math.random() > 0.45 ? 'IN' : 'OUT';
  const payload = {
    lotCode,
    plate,
    direction,
    confidence: Number((0.88 + Math.random() * 0.1).toFixed(2)),
    sensorCode: 'CAM-LPR-D2-01',
  };

  try {
    const res = await fetch(`${apiBase}/parking/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-token': token,
      },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[lpr-sim] falhou', res.status, body);
      return;
    }
    console.log(`[lpr-sim] ${direction} ${plate} · confiança ${payload.confidence}`);
  } catch (err) {
    console.error('[lpr-sim] erro', err instanceof Error ? err.message : err);
  }
}

console.log(`[lpr-sim] a enviar para ${apiBase}/parking/ingest`);
void tick();
setInterval(() => void tick(), intervalMs);
