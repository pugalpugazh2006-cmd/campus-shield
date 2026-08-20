import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config';

const expressApp = express();
let ready = false;

async function bootstrap(): Promise<void> {
  if (ready) return;

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    { bufferLogs: false, logger: ['error', 'warn'] },
  );

  const config = app.get(ConfigService<AppConfig, true>);

  app.use(helmet());
  app.setGlobalPrefix(config.get('API_PREFIX', { infer: true }));

  const origins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({
    origin: origins.length === 0 ? '*' : origins,
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  await app.init();
  ready = true;
}

// Vercel serverless handler
export default async function handler(
  req: express.Request,
  res: express.Response,
): Promise<void> {
  try {
    await bootstrap();
    expressApp(req, res);
  } catch (err) {
    console.error('[serverless] Bootstrap failed:', err);
    res.status(500).json({ error: 'Service failed to initialize', detail: String(err) });
  }
}
