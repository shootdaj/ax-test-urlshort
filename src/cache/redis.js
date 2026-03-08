const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client = null;

/**
 * Get or create the Redis client singleton.
 * Returns null if Redis is not available (graceful degradation).
 */
async function getClient() {
  if (client && client.isOpen) {
    return client;
  }

  try {
    client = createClient({ url: REDIS_URL });

    client.on('error', (err) => {
      console.error('Redis client error:', err.message);
    });

    await client.connect();
    return client;
  } catch (err) {
    console.error('Failed to connect to Redis:', err.message);
    client = null;
    return null;
  }
}

/**
 * Check Redis connectivity. Returns { connected, latencyMs }.
 */
async function healthCheck() {
  const start = Date.now();
  try {
    const redis = await getClient();
    if (!redis) {
      return { connected: false, latencyMs: null };
    }
    await redis.ping();
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { connected: false, latencyMs: null, error: err.message };
  }
}

/**
 * Disconnect the Redis client (for graceful shutdown / tests).
 */
async function disconnect() {
  if (client && client.isOpen) {
    await client.quit();
    client = null;
  }
}

module.exports = { getClient, healthCheck, disconnect };
