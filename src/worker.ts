import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config';
import { DispatchWorker } from './dispatch/dispatch.worker';

async function bootstrapWorker(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const config = application.get(ConfigService<AppConfig, true>);
  const dispatchWorker = application.get(DispatchWorker);
  const logger = new Logger('CampusShieldWorker');
  let stopping = false;

  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    await application.close();
  };
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());

  while (!stopping) {
    try {
      const result = await dispatchWorker.runBatch();
      if (
        result.assigned > 0 ||
        result.timedOut > 0 ||
        result.grantsRepaired > 0 ||
        result.cleanupsRepaired > 0
      ) {
        logger.log(
          `Dispatch cycle assigned=${result.assigned} timedOut=${result.timedOut} grantsRepaired=${result.grantsRepaired} cleanupsRepaired=${result.cleanupsRepaired}`,
        );
      }
    } catch (error: unknown) {
      logger.error(
        `Dispatch cycle failed (${error instanceof Error ? error.name : 'unknown error'})`,
      );
    }
    if (!stopping) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, config.get('WORKER_POLL_INTERVAL_MS', { infer: true })),
      );
    }
  }
}

void bootstrapWorker();
