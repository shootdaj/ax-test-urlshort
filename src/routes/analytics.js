const express = require('express');
const db = require('../db/pool');

const router = express.Router();

// Get click analytics for a URL
router.get('/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const urlResult = await db.query('SELECT * FROM urls WHERE slug = $1', [slug]);
    if (urlResult.rows.length === 0) {
      return res.status(404).json({ error: 'URL not found' });
    }

    const urlId = urlResult.rows[0].id;

    const [totalClicks, clicksByDay, topReferrers] = await Promise.all([
      db.query('SELECT COUNT(*) as total FROM clicks WHERE url_id = $1', [urlId]),
      db.query(
        `SELECT DATE(clicked_at) as date, COUNT(*) as clicks
         FROM clicks WHERE url_id = $1
         GROUP BY DATE(clicked_at) ORDER BY date DESC LIMIT 30`,
        [urlId]
      ),
      db.query(
        `SELECT referrer, COUNT(*) as count
         FROM clicks WHERE url_id = $1 AND referrer IS NOT NULL
         GROUP BY referrer ORDER BY count DESC LIMIT 10`,
        [urlId]
      ),
    ]);

    res.json({
      url: urlResult.rows[0],
      analytics: {
        total_clicks: parseInt(totalClicks.rows[0].total),
        clicks_by_day: clicksByDay.rows,
        top_referrers: topReferrers.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
