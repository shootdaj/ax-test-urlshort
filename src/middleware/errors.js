function errorHandler(err, req, res, _next) {
  console.error(err.stack);

  if (err.code === '23505') {
    return res.status(409).json({ error: 'Slug already exists' });
  }

  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { errorHandler };
