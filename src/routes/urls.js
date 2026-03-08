const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db/pool');
const { validateUrl, validateSlug } = require('../utils/validation');

const router = express.Router();

// Create short URL
router.post('/', async (req, res, next) => {
  try {
    const { url, customSlug } = req.body;

    // Validate URL
    const urlCheck = validateUrl(url);
    if (!urlCheck.valid) {
      return res.status(400).json({ error: urlCheck.error });
    }

    // Validate custom slug if provided
    const slugCheck = validateSlug(customSlug);
    if (!slugCheck.valid) {
      return res.status(400).json({ error: slugCheck.error });
    }

    const slug = customSlug || nanoid(8);
    const result = await db.query(
      'INSERT INTO urls (slug, original_url) VALUES ($1, $2) RETURNING *',
      [slug, url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Get URL info (without redirect)
router.get('/:slug/info', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const result = await db.query('SELECT * FROM urls WHERE slug = $1', [slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'URL not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Redirect
router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const result = await db.query('SELECT * FROM urls WHERE slug = $1', [slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'URL not found' });
    }

    // Record click
    await db.query(
      'INSERT INTO clicks (url_id, referrer, user_agent, ip_address) VALUES ($1, $2, $3, $4)',
      [result.rows[0].id, req.get('referer'), req.get('user-agent'), req.ip]
    );

    res.redirect(301, result.rows[0].original_url);
  } catch (err) {
    next(err);
  }
});

// List URLs
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT u.*, COUNT(c.id) as click_count FROM urls u LEFT JOIN clicks c ON u.id = c.url_id GROUP BY u.id ORDER BY u.created_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Delete URL
router.delete('/:slug', async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM urls WHERE slug = $1 RETURNING *', [req.params.slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'URL not found' });
    }
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
