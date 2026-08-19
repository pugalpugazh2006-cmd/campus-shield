import { validateEnvironment } from './environment.validation';

const validEnvironment = {
  NODE_ENV: 'test',
  FIREBASE_PROJECT_ID: 'test-project',
  FIREBASE_CLIENT_EMAIL: 'firebase@example.test',
  FIREBASE_PRIVATE_KEY: 'line-one\\nline-two',
  FIREBASE_DATABASE_URL: 'https://test-project.firebaseio.com',
  CAMPUS_ID: 'main',
  ROUTING_PROVIDER_URL: 'https://routing.example.test',
  ROUTING_PROVIDER_API_KEY: 'test-api-key',
};

describe('validateEnvironment', () => {
  it('applies safe runtime defaults and normalizes the private key', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result.PORT).toBe(3000);
    expect(result.API_PREFIX).toBe('api/v1');
    expect(result.FIREBASE_PRIVATE_KEY).toBe('line-one\nline-two');
    expect(result.ASSIGNMENT_TTL_SECONDS).toBe(30);
  });

  it('rejects missing Firebase credentials', () => {
    expect(() => validateEnvironment({ ...validEnvironment, FIREBASE_PROJECT_ID: '' })).toThrow(
      'FIREBASE_PROJECT_ID',
    );
  });

  it('prevents campus configuration from drifting from Firebase rules', () => {
    expect(() => validateEnvironment({ ...validEnvironment, CAMPUS_ID: 'another-campus' })).toThrow(
      'CAMPUS_ID must be main',
    );
  });

  it('allows native-app-only production deployments to deny browser origins', () => {
    const result = validateEnvironment({
      ...validEnvironment,
      NODE_ENV: 'production',
      CORS_ORIGINS: '',
    });

    expect(result.CORS_ORIGINS).toEqual([]);
  });
});
