import { startNotificationDispatcher } from './modules/financial/application/notificationDeliveryService.js';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { startMqttIngest } from './modules/iot/application/mqttIngestService.js';

async function main() {
  const env = loadEnv();
  const app = createApp();
  const stopNotifications = startNotificationDispatcher();

  const server = app.listen(env.API_PORT, env.API_HOST, () => {
    logger.info('Smart Campus API a escutar', {
      host: env.API_HOST,
      port: env.API_PORT,
      docs: `http://localhost:${env.API_PORT}/api/docs`,
    });
  });

  // Telemetria MQTT (não arranca nos testes)
  const stopMqtt = process.env.NODE_ENV === 'test' ? () => {} : startMqttIngest();

  const shutdown = async (signal: string) => {
    logger.info('A encerrar', { signal });
    stopNotifications();
    stopMqtt();
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(async (err) => {
  logger.error('Falha ao iniciar API', { error: err instanceof Error ? err.message : 'unknown' });
  await prisma.$disconnect();
  process.exit(1);
});
