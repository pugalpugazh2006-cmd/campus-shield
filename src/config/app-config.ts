export type NodeEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  NODE_ENV: NodeEnvironment;
  PORT: number;
  API_PREFIX: string;
  CORS_ORIGINS: string[];
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_DATABASE_URL: string;
  CAMPUS_ID: string;
  ASSIGNMENT_TTL_SECONDS: number;
  DISPATCH_LOCATION_FRESHNESS_SECONDS: number;
  DISPATCH_MAX_LOCATION_ACCURACY_METERS: number;
  ROUTING_PROVIDER_URL: string;
  ROUTING_PROVIDER_API_KEY: string;
  ROUTING_TIMEOUT_MS: number;
  ROUTING_ORIGIN_TOLERANCE_METERS: number;
  ROUTING_DESTINATION_TOLERANCE_METERS: number;
  LOCATION_ACCESS_TTL_SECONDS: number;
  WORKER_POLL_INTERVAL_MS: number;
}
