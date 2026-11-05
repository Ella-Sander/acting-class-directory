ALTER TABLE instructors ADD COLUMN slug TEXT;
ALTER TABLE instructors ADD COLUMN biography TEXT;
ALTER TABLE instructors ADD COLUMN teaching_experience TEXT;
ALTER TABLE instructors ADD COLUMN booking_url TEXT;
ALTER TABLE instructors ADD COLUMN professional_title TEXT;
ALTER TABLE instructors ADD COLUMN profile_status TEXT NOT NULL DEFAULT 'draft'
  CHECK (profile_status IN ('draft', 'published', 'archived'));
ALTER TABLE instructors ADD COLUMN image_url TEXT;
ALTER TABLE instructors ADD COLUMN image_source_url TEXT;
ALTER TABLE instructors ADD COLUMN image_alt TEXT;
ALTER TABLE instructors ADD COLUMN image_permission_status TEXT NOT NULL DEFAULT 'not_provided'
  CHECK (image_permission_status IN ('not_provided', 'pending_review', 'approved', 'rejected'));
ALTER TABLE instructors ADD COLUMN image_permission_url TEXT;
ALTER TABLE instructors ADD COLUMN image_attribution TEXT;
ALTER TABLE instructors ADD COLUMN last_verified_at TEXT;

CREATE UNIQUE INDEX idx_instructors_slug ON instructors(slug) WHERE slug IS NOT NULL;
CREATE INDEX idx_instructors_profile_status ON instructors(profile_status, name);

CREATE TABLE instructor_locations (
  instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (instructor_id, location_id)
);

CREATE TABLE instructor_terms (
  instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  term_id TEXT NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('verified', 'unverified', 'not_provided')),
  source_url TEXT,
  verified_at TEXT,
  PRIMARY KEY (instructor_id, term_id)
);

UPDATE instructors SET slug = 'james-price-acting-teacher', profile_status = 'published',
  professional_title = 'Acting teacher',
  last_verified_at = '2026-11-05'
  WHERE id = 'instructor-james-price';
UPDATE instructors SET slug = 'brian-j-carter-acting-teacher', profile_status = 'published',
  professional_title = 'Acting teacher',
  last_verified_at = '2026-11-05'
  WHERE id = 'instructor-brian-carter';
UPDATE instructors SET slug = 'sam-lilja-dialect-coach', profile_status = 'published',
  professional_title = 'Dialect coach',
  last_verified_at = '2026-11-05'
  WHERE id = 'instructor-sam-lilja';
UPDATE instructors SET slug = 'jason-bennett-acting-coach', profile_status = 'published',
  professional_title = 'Acting and audition coach',
  last_verified_at = '2026-11-05'
  WHERE id = 'instructor-jason-bennett';

INSERT OR IGNORE INTO instructor_locations (instructor_id, location_id)
  SELECT pi.instructor_id, pl.location_id FROM provider_instructors pi
  JOIN provider_locations pl ON pl.provider_id = pi.provider_id
  WHERE pi.instructor_id IN ('instructor-james-price','instructor-brian-carter','instructor-sam-lilja','instructor-jason-bennett');
INSERT OR IGNORE INTO instructor_locations (instructor_id, location_id)
  SELECT oi.instructor_id, ol.location_id FROM offering_instructors oi
  JOIN offering_locations ol ON ol.offering_id = oi.offering_id
  WHERE oi.instructor_id IN ('instructor-james-price','instructor-brian-carter','instructor-sam-lilja','instructor-jason-bennett');

INSERT OR IGNORE INTO instructor_terms (instructor_id, term_id, verification_status, source_url, verified_at)
  SELECT oi.instructor_id, ot.term_id, ot.verification_status, ot.source_url, ot.verified_at
  FROM offering_instructors oi JOIN offering_terms ot ON ot.offering_id = oi.offering_id
  WHERE oi.instructor_id IN ('instructor-james-price','instructor-brian-carter','instructor-sam-lilja','instructor-jason-bennett');

INSERT OR IGNORE INTO field_evidence (entity_type, entity_id, field_name, verification_status, source_url, verified_at, note)
  SELECT 'instructor', id, 'profile', 'verified', website_url, '2026-11-05',
    'Individual instructor identity and existing directory description traced to the linked official provider source.'
  FROM instructors WHERE profile_status = 'published';

INSERT OR IGNORE INTO research_sources (entity_type, entity_id, source_url, source_type, verification_status, checked_at, note)
  SELECT 'instructor', i.id, i.website_url, 'official_website', 'verified', '2026-11-05',
    'Official source already recorded for this individual instructor in the reviewed seed data.'
  FROM instructors i WHERE i.profile_status = 'published' AND i.website_url IS NOT NULL;
