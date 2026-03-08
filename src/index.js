const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const { pool } = require('./db/pool');
const urlRoutes = require('./routes/urls');
const analyticsRoutes = require('./routes/analytics');
const { errorHandler } = require('./middleware/errors');
const { rateLimit } = require('./middleware/rateLimit');
const { healthCheck: redisHealthCheck } = require('./cache/redis');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Basic health check
app.get('/health', async (req, res) => {
  const redis = await redisHealthCheck();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    redis: {
      connected: redis.connected,
      latencyMs: redis.latencyMs || null,
    },
  });
});

// Apply rate limiter to URL creation endpoint
app.use('/api/urls', (req, res, next) => {
  if (req.method === 'POST') {
    return rateLimit({ windowSeconds: 60, maxRequests: 10 })(req, res, next);
  }
  next();
});

app.use('/api/urls', urlRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`URL shortener running on port ${PORT}`);
  });
}

module.exports = { app };
