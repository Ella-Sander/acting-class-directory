-- Additive provider identity support. Existing provider, instructor, offering,
-- submission, claim, and SEO records remain intact until individually reviewed.

ALTER TABLE providers ADD COLUMN provider_classification TEXT
  CHECK (provider_classification IN (
    'independent_teacher',
    'studio_business',
    'institution',
    'unconfirmed'
  ) OR provider_classification IS NULL);

-- Store exact provider URLs and their role. Multiple providers may share a host
-- or booking platform, so normalized_url is deliberately not globally unique.
CREATE TABLE provider_site_urls (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  url_role TEXT NOT NULL CHECK (url_role IN (
    'official',
    'booking',
    'profile',
    'legacy',
    'other'
  )),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  verification_status TEXT NOT NULL DEFAULT 'unconfirmed'
    CHECK (verification_status IN ('verified', 'unverified', 'unconfirmed')),
  source_url TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider_id, normalized_url)
);

CREATE INDEX idx_provider_site_urls_normalized
  ON provider_site_urls(normalized_url);
CREATE INDEX idx_provider_site_urls_provider_primary
  ON provider_site_urls(provider_id, is_primary, url_role);

-- Redirect only reviewed old profile paths; target can be a provider route or a
-- retained, meaningful course/instructor page. The redirect itself is auditable.
CREATE TABLE provider_url_redirects (
  source_path TEXT PRIMARY KEY,
  target_path TEXT NOT NULL,
  target_provider_id TEXT REFERENCES providers(id) ON DELETE RESTRICT,
  http_status INTEGER NOT NULL DEFAULT 308 CHECK (http_status IN (301, 308)),
  reason TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (source_path LIKE '/%' AND target_path LIKE '/%' AND source_path <> target_path)
);

CREATE INDEX idx_provider_url_redirects_target
  ON provider_url_redirects(target_path);
