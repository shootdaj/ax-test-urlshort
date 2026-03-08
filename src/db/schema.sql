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
  clicked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_urls_slug ON urls(slug);
CREATE INDEX idx_clicks_url_id ON clicks(url_id);
CREATE INDEX idx_clicks_clicked_at ON clicks(clicked_at);
