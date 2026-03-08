const express = require('express');
const { nanoid } = require('nanoid');
const db = require('../db/pool');
const { validateUrl, validateSlug, validateSlugParam } = require('../utils/validation');
const { parseUserAgent } = require('../utils/useragent');
const urlCache = require('../cache/urlCache');

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

    // Cache the new URL for fast redirect lookups
    await urlCache.setUrl(slug, result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Get URL info (without redirect)
router.get('/:slug/info', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const slugCheck = validateSlugParam(slug);
    if (!slugCheck.valid) {
      return res.status(400).json({ error: slugCheck.error });
    }
    const result = await db.query('SELECT * FROM urls WHERE slug = $1', [slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'URL not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// Redirect — cache-aside pattern: check cache first, fall back to DB
router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const slugCheck = validateSlugParam(slug);
    if (!slugCheck.valid) {
      return res.status(400).json({ error: slugCheck.error });
    }

    // 1. Try cache first
    let urlRecord = await urlCache.getUrl(slug);

    // 2. Cache miss — query DB and populate cache
    if (!urlRecord) {
      const result = await db.query('SELECT * FROM urls WHERE slug = $1', [slug]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'URL not found' });
      }
      urlRecord = result.rows[0];

      // Populate cache for next time (non-blocking)
      urlCache.setUrl(slug, urlRecord).catch((err) => {
        console.error('Failed to populate cache:', err.message);
      });
    }

    // Record click (non-blocking — don't delay the redirect)
    // Sanitize metadata: truncate to prevent oversized storage
    const rawUserAgent = req.get('user-agent') || '';
    const userAgent = rawUserAgent.slice(0, 512);
    const { browser, os } = parseUserAgent(userAgent);
    const referrer = (req.get('referer') || '').slice(0, 2048) || null;
    const ipAddress = (req.ip || '').slice(0, 45);
    db.query(
      'INSERT INTO clicks (url_id, referrer, user_agent, ip_address, browser, os) VALUES ($1, $2, $3, $4, $5, $6)',
      [urlRecord.id, referrer, userAgent, ipAddress, browser, os]
    ).catch((err) => {
      console.error('Failed to record click:', err.message);
    });

    // Open redirect protection: re-validate URL scheme before redirecting
    const redirectCheck = validateUrl(urlRecord.original_url);
    if (!redirectCheck.valid) {
      return res.status(502).json({ error: 'Stored URL is invalid or uses a disallowed scheme' });
    }

    res.redirect(301, urlRecord.original_url);
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

// Delete URL — invalidate cache
router.delete('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const slugCheck = validateSlugParam(slug);
    if (!slugCheck.valid) {
      return res.status(400).json({ error: slugCheck.error });
    }
    const result = await db.query('DELETE FROM urls WHERE slug = $1 RETURNING *', [slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'URL not found' });
    }

    // Invalidate cache (non-blocking)
    urlCache.invalidate(slug).catch((err) => {
      console.error('Failed to invalidate cache:', err.message);
    });

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
