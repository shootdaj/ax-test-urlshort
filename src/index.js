const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const { pool } = require('./db/pool');
const urlRoutes = require('./routes/urls');
const analyticsRoutes = require('./routes/analytics');
const { errorHandler } = require('./middleware/errors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
