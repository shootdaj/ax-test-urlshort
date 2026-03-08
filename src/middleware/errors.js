function errorHandler(err, req, res, _next) {
  // In production, only log the error message; in development, log the full stack
  if (process.env.NODE_ENV === 'production') {
    console.error('Error:', err.message);
  } else {
    console.error(err.stack);
  }

  // Handle request entity too large (body size limit exceeded)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }

  // Handle malformed JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  if (err.code === '23505') {
    return res.status(409).json({ error: 'Slug already exists' });
  }

  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { errorHandler };
