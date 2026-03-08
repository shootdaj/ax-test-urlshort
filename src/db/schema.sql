CREATE TABLE IF NOT EXISTS urls (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(32) UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clicks (
  id SERIAL PRIMARY KEY,
  url_id INTEGER REFERENCES urls(id) ON DELETE CASCADE,
  referrer TEXT,
  user_agent TEXT,
  ip_address VARCHAR(45),
  browser VARCHAR(50),
  os VARCHAR(50),
  clicked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_urls_slug ON urls(slug);
CREATE INDEX IF NOT EXISTS idx_clicks_url_id ON clicks(url_id);
CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON clicks(clicked_at);

-- Phase 2: Analytics indexes
CREATE INDEX IF NOT EXISTS idx_clicks_url_id_clicked_at ON clicks(url_id, clicked_at);
CREATE INDEX IF NOT EXISTS idx_clicks_ip_address ON clicks(ip_address);
CREATE INDEX IF NOT EXISTS idx_clicks_referrer ON clicks(referrer) WHERE referrer IS NOT NULL;
