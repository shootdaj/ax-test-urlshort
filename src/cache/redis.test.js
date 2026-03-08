/**
 * Unit tests for the Redis client wrapper module exports.
 *
 * The redis.js module creates a real Redis connection on getClient().
 * Since Redis isn't running in the unit test environment, we only test
 * the module's export shape and safe no-op behaviors.
 * Full Redis integration tests are in test/integration/.
 */

const redis = require('./redis');

describe('module exports', () => {
  it('should export getClient as a function', () => {
    expect(typeof redis.getClient).toBe('function');
  });

  it('should export healthCheck as a function', () => {
    expect(typeof redis.healthCheck).toBe('function');
  });

  it('should export disconnect as a function', () => {
    expect(typeof redis.disconnect).toBe('function');
  });
});
