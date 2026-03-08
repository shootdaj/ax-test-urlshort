const express = require('express');
const db = require('../db/pool');
const { validateDateParam } = require('../utils/validation');

const router = express.Router();

/**
 * Build a WHERE clause for date-range filtering.
 * @param {number} urlId
 * @param {string|undefined} start - YYYY-MM-DD
 * @param {string|undefined} end - YYYY-MM-DD
 * @returns {{ clause: string, params: any[] }}
 */
function buildDateFilter(urlId, start, end) {
  const conditions = ['url_id = $1'];
  const params = [urlId];
  let idx = 2;

  if (start) {
    conditions.push(`clicked_at >= $${idx}::timestamp`);
    params.push(start + 'T00:00:00Z');
    idx++;
  }
  if (end) {
    conditions.push(`clicked_at < ($${idx}::timestamp + interval '1 day')`);
    params.push(end + 'T00:00:00Z');
    idx++;
  }

  return { clause: conditions.join(' AND '), params };
}

// Global analytics summary: GET /api/analytics
router.get('/', async (req, res, next) => {
  try {
    const [urlCount, clickCount, topUrls] = await Promise.all([
      db.query('SELECT COUNT(*) as total FROM urls'),
      db.query('SELECT COUNT(*) as total FROM clicks'),
      db.query(
        `SELECT u.slug, u.original_url, COUNT(c.id) as click_count
         FROM urls u LEFT JOIN clicks c ON u.id = c.url_id
         GROUP BY u.id, u.slug, u.original_url
         ORDER BY click_count DESC LIMIT 10`
      ),
    ]);

    res.json({
      total_urls: parseInt(urlCount.rows[0].total),
      total_clicks: parseInt(clickCount.rows[0].total),
      top_urls: topUrls.rows.map((row) => ({
        slug: row.slug,
        original_url: row.original_url,
        click_count: parseInt(row.click_count),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// Per-URL analytics: GET /api/analytics/:slug?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { start, end } = req.query;

    // Validate date params
    const startCheck = validateDateParam(start);
    if (!startCheck.valid) {
      return res.status(400).json({ error: `Invalid start date: ${startCheck.error}` });
    }
    const endCheck = validateDateParam(end);
    if (!endCheck.valid) {
      return res.status(400).json({ error: `Invalid end date: ${endCheck.error}` });
    }

    const urlResult = await db.query('SELECT * FROM urls WHERE slug = $1', [slug]);
    if (urlResult.rows.length === 0) {
      return res.status(404).json({ error: 'URL not found' });
    }

    const urlId = urlResult.rows[0].id;
    const { clause, params } = buildDateFilter(urlId, start, end);

    const [totalClicks, uniqueVisitors, clicksByDay, clicksByHour, topReferrers, browserBreakdown] = await Promise.all([
      db.query(`SELECT COUNT(*) as total FROM clicks WHERE ${clause}`, params),
      db.query(`SELECT COUNT(DISTINCT ip_address) as total FROM clicks WHERE ${clause}`, params),
      db.query(
        `SELECT DATE(clicked_at) as date, COUNT(*) as clicks
         FROM clicks WHERE ${clause}
         GROUP BY DATE(clicked_at) ORDER BY date DESC LIMIT 30`,
        params
      ),
      db.query(
        `SELECT EXTRACT(HOUR FROM clicked_at)::int as hour, COUNT(*) as clicks
         FROM clicks WHERE ${clause}
         GROUP BY EXTRACT(HOUR FROM clicked_at)
         ORDER BY hour`,
        params
      ),
      db.query(
        `SELECT referrer, COUNT(*) as count
         FROM clicks WHERE ${clause} AND referrer IS NOT NULL
         GROUP BY referrer ORDER BY count DESC LIMIT 10`,
        params
      ),
      db.query(
        `SELECT COALESCE(browser, 'Unknown') as browser, COUNT(*) as count
         FROM clicks WHERE ${clause}
         GROUP BY browser ORDER BY count DESC LIMIT 10`,
        params
      ),
    ]);

    res.json({
      url: urlResult.rows[0],
      analytics: {
        total_clicks: parseInt(totalClicks.rows[0].total),
        unique_visitors: parseInt(uniqueVisitors.rows[0].total),
        clicks_by_day: clicksByDay.rows.map((row) => ({
          date: row.date,
          clicks: parseInt(row.clicks),
        })),
        clicks_by_hour: clicksByHour.rows.map((row) => ({
          hour: row.hour,
          clicks: parseInt(row.clicks),
        })),
        top_referrers: topReferrers.rows.map((row) => ({
          referrer: row.referrer,
          count: parseInt(row.count),
        })),
        browser_breakdown: browserBreakdown.rows.map((row) => ({
          browser: row.browser,
          count: parseInt(row.count),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports._buildDateFilter = buildDateFilter;
