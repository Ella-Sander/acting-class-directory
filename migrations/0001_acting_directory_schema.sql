PRAGMA foreign_keys = ON;

CREATE TABLE providers (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('studio', 'school', 'coach')),
  name TEXT NOT NULL,
  description TEXT,
  teaching_approach TEXT,
  website_url TEXT,
  instagram_url TEXT,
  featured_image_url TEXT,
  image_source_url TEXT,
  source_url TEXT,
  listing_status TEXT NOT NULL DEFAULT 'draft' CHECK (listing_status IN ('draft', 'published', 'archived')),
  claim_status TEXT NOT NULL DEFAULT 'unclaimed' CHECK (claim_status IN ('unclaimed', 'pending', 'claimed')),
  origin TEXT NOT NULL DEFAULT 'seeded' CHECK (origin IN ('seeded', 'submitted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE instructors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  website_url TEXT,
  instagram_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  city TEXT,
  region TEXT,
  country_code TEXT NOT NULL DEFAULT 'US',
  borough TEXT,
  neighborhood TEXT,
  postal_address TEXT,
  is_online INTEGER NOT NULL DEFAULT 0 CHECK (is_online IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE provider_locations (
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  PRIMARY KEY (provider_id, location_id)
);

CREATE TABLE offerings (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  featured_image_url TEXT,
  registration_url TEXT,
  format TEXT CHECK (format IN ('in_person', 'online', 'hybrid')),
  price_min REAL CHECK (price_min IS NULL OR price_min >= 0),
  price_max REAL CHECK (price_max IS NULL OR price_max >= 0),
  currency TEXT,
  price_basis TEXT CHECK (price_basis IN ('per_session', 'hourly', 'full_course', 'workshop', 'other')),
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  session_count INTEGER CHECK (session_count IS NULL OR session_count > 0),
  schedule_text TEXT,
  skill_level TEXT,
  genre_specialty TEXT,
  audition_required INTEGER CHECK (audition_required IN (0, 1) OR audition_required IS NULL),
  interview_required INTEGER CHECK (interview_required IN (0, 1) OR interview_required IS NULL),
  instruction_mode TEXT CHECK (instruction_mode IN ('group', 'private', 'both') OR instruction_mode IS NULL),
  enrollment_url TEXT,
  source_url TEXT,
  listing_status TEXT NOT NULL DEFAULT 'draft' CHECK (listing_status IN ('draft', 'published', 'archived')),
  origin TEXT NOT NULL DEFAULT 'seeded' CHECK (origin IN ('seeded', 'submitted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE offering_locations (
  offering_id TEXT NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (offering_id, location_id)
);

CREATE TABLE provider_instructors (
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  PRIMARY KEY (provider_id, instructor_id)
);

CREATE TABLE offering_instructors (
  offering_id TEXT NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  PRIMARY KEY (offering_id, instructor_id)
);

CREATE TABLE taxonomy_terms (
  id TEXT PRIMARY KEY,
  taxonomy TEXT NOT NULL CHECK (taxonomy IN ('training_type', 'technique', 'genre', 'specialty')),
  term TEXT NOT NULL,
  slug TEXT NOT NULL,
  UNIQUE (taxonomy, slug)
);

CREATE TABLE provider_terms (
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  term_id TEXT NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'unverified', 'not_provided')),
  source_url TEXT,
  verified_at TEXT,
  PRIMARY KEY (provider_id, term_id)
);

CREATE TABLE offering_terms (
  offering_id TEXT NOT NULL REFERENCES offerings(id) ON DELETE CASCADE,
  term_id TEXT NOT NULL REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'unverified', 'not_provided')),
  source_url TEXT,
  verified_at TEXT,
  PRIMARY KEY (offering_id, term_id)
);

CREATE TABLE field_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('provider', 'offering', 'instructor', 'location')),
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('verified', 'unverified', 'not_provided')),
  source_url TEXT,
  verified_at TEXT,
  note TEXT,
  UNIQUE (entity_type, entity_id, field_name)
);

CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('provider', 'offering', 'claim', 'profile_update')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  contact_name TEXT,
  contact_email TEXT NOT NULL,
  website_url TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  duplicate_of_provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  provider_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  website_url TEXT,
  instagram_url TEXT,
  verification_information TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

CREATE TABLE provider_update_suggestions (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  submission_id TEXT REFERENCES submissions(id) ON DELETE SET NULL,
  suggested_payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

CREATE TABLE approval_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'reopened')),
  actor TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_providers_status_type ON providers(listing_status, listing_type);
CREATE INDEX idx_providers_slug ON providers(slug);
CREATE INDEX idx_offerings_status_provider ON offerings(listing_status, provider_id);
CREATE INDEX idx_offerings_price ON offerings(price_min, price_max, price_basis, currency);
CREATE INDEX idx_locations_city_borough ON locations(city, borough);
CREATE INDEX idx_provider_terms_verified ON provider_terms(term_id, verification_status);
CREATE INDEX idx_offering_terms_verified ON offering_terms(term_id, verification_status);
CREATE INDEX idx_submissions_status_date ON submissions(status, submitted_at);
CREATE INDEX idx_claims_status_date ON claims(status, created_at);

INSERT INTO taxonomy_terms (id, taxonomy, term, slug) VALUES
 ('training-acting-classes','training_type','Acting Classes','acting-classes'),
 ('training-on-camera','training_type','On-Camera Acting','on-camera-acting'),
 ('training-scene-study','training_type','Scene Study','scene-study'),
 ('training-improv','training_type','Improv','improv'),
 ('training-audition','training_type','Audition Technique','audition-technique'),
 ('training-voice-movement','training_type','Voice and Movement','voice-and-movement'),
 ('training-workshops','training_type','Workshops and Intensives','workshops-and-intensives'),
 ('technique-meisner','technique','Meisner','meisner'),
 ('technique-stanislavski','technique','Stanislavski','stanislavski'),
 ('technique-method','technique','Method Acting','method-acting'),
 ('technique-uta-hagen','technique','Uta Hagen','uta-hagen'),
 ('technique-chekhov','technique','Michael Chekhov','michael-chekhov'),
 ('technique-other','technique','Other','other');
