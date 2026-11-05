ALTER TABLE providers ADD COLUMN image_alt TEXT;
ALTER TABLE providers ADD COLUMN image_permission_status TEXT NOT NULL DEFAULT 'not_provided'
  CHECK (image_permission_status IN ('not_provided', 'pending_review', 'approved', 'rejected'));
ALTER TABLE providers ADD COLUMN image_permission_url TEXT;
ALTER TABLE providers ADD COLUMN image_attribution TEXT;
ALTER TABLE providers ADD COLUMN last_verified_at TEXT;

ALTER TABLE offerings ADD COLUMN image_alt TEXT;
ALTER TABLE offerings ADD COLUMN image_permission_status TEXT NOT NULL DEFAULT 'not_provided'
  CHECK (image_permission_status IN ('not_provided', 'pending_review', 'approved', 'rejected'));
ALTER TABLE offerings ADD COLUMN image_permission_url TEXT;
ALTER TABLE offerings ADD COLUMN image_attribution TEXT;
ALTER TABLE offerings ADD COLUMN last_verified_at TEXT;

CREATE TABLE research_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('provider', 'offering', 'instructor', 'location')),
  entity_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('official_website', 'official_registration', 'official_social', 'other')),
  verification_status TEXT NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'unavailable', 'pending_review')),
  checked_at TEXT NOT NULL,
  note TEXT,
  UNIQUE (entity_type, entity_id, source_url)
);
CREATE INDEX idx_research_sources_entity ON research_sources(entity_type, entity_id, checked_at);
