import { AppConfig, NodeEnvironment } from './app-config';

const ENVIRONMENTS = new Set<NodeEnvironment>(['development', 'test', 'production']);

function requiredString(config: Record<string, unknown>, key: keyof AppConfig): string {
  const value = config[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value.trim();
}

function optionalString(
  config: Record<string, unknown>,
  key: keyof AppConfig,
  fallback: string,
): string {
  const value = config[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'string') {
    throw new Error(`Environment variable ${key} must be a string`);
  }
  return value;
}

function parsePort(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : 3000;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return parsed;
}

function parseInteger(
  value: unknown,
  fallback: number,
  key: keyof AppConfig,
  minimum: number,
  maximum: number,
): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${key} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

function validUrl(config: Record<string, unknown>, key: keyof AppConfig): string {
  const value = requiredString(config, key).replace(/\/+$/, '');
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') throw new Error();
  } catch {
    throw new Error(`${key} must be an HTTPS URL (HTTP is allowed only for localhost)`);
  }
  return value;
}

export function validateEnvironment(config: Record<string, unknown>): AppConfig {
  const nodeEnvironment = (config.NODE_ENV ?? 'development') as NodeEnvironment;
  if (!ENVIRONMENTS.has(nodeEnvironment)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const origins = optionalString(config, 'CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const campusId = requiredString(config, 'CAMPUS_ID');
  if (campusId !== 'main') {
    throw new Error('CAMPUS_ID must be main while Firebase rules are single-campus');
  }

  return {
    NODE_ENV: nodeEnvironment,
    PORT: parsePort(config.PORT),
    API_PREFIX: optionalString(config, 'API_PREFIX', 'api/v1').replace(/^\/+|\/+$/g, ''),
    CORS_ORIGINS: origins,
    FIREBASE_PROJECT_ID: requiredString(config, 'FIREBASE_PROJECT_ID'),
    FIREBASE_CLIENT_EMAIL: requiredString(config, 'FIREBASE_CLIENT_EMAIL'),
    FIREBASE_PRIVATE_KEY: requiredString(config, 'FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    FIREBASE_DATABASE_URL: requiredString(config, 'FIREBASE_DATABASE_URL'),
    CAMPUS_ID: campusId,
    ASSIGNMENT_TTL_SECONDS: parseInteger(
      config.ASSIGNMENT_TTL_SECONDS,
      30,
      'ASSIGNMENT_TTL_SECONDS',
      10,
      300,
    ),
    DISPATCH_LOCATION_FRESHNESS_SECONDS: parseInteger(
      config.DISPATCH_LOCATION_FRESHNESS_SECONDS,
      30,
      'DISPATCH_LOCATION_FRESHNESS_SECONDS',
      5,
      300,
    ),
    DISPATCH_MAX_LOCATION_ACCURACY_METERS: parseInteger(
      config.DISPATCH_MAX_LOCATION_ACCURACY_METERS,
      100,
      'DISPATCH_MAX_LOCATION_ACCURACY_METERS',
      10,
      1000,
    ),
    ROUTING_PROVIDER_URL: validUrl(config, 'ROUTING_PROVIDER_URL'),
    ROUTING_PROVIDER_API_KEY: requiredString(config, 'ROUTING_PROVIDER_API_KEY'),
    ROUTING_TIMEOUT_MS: parseInteger(
      config.ROUTING_TIMEOUT_MS,
      5000,
      'ROUTING_TIMEOUT_MS',
      500,
      20000,
    ),
    ROUTING_ORIGIN_TOLERANCE_METERS: parseInteger(
      config.ROUTING_ORIGIN_TOLERANCE_METERS,
      75,
      'ROUTING_ORIGIN_TOLERANCE_METERS',
      10,
      500,
    ),
    ROUTING_DESTINATION_TOLERANCE_METERS: parseInteger(
      config.ROUTING_DESTINATION_TOLERANCE_METERS,
      30,
      'ROUTING_DESTINATION_TOLERANCE_METERS',
      5,
      200,
    ),
    LOCATION_ACCESS_TTL_SECONDS: parseInteger(
      config.LOCATION_ACCESS_TTL_SECONDS,
      7200,
      'LOCATION_ACCESS_TTL_SECONDS',
      300,
      86400,
    ),
    WORKER_POLL_INTERVAL_MS: parseInteger(
      config.WORKER_POLL_INTERVAL_MS,
      5000,
      'WORKER_POLL_INTERVAL_MS',
      1000,
      60000,
    ),
  };
}
