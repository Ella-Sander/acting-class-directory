ALTER TABLE instructors ADD COLUMN claim_status TEXT NOT NULL DEFAULT 'unclaimed'
  CHECK (claim_status IN ('unclaimed', 'pending', 'claimed'));

CREATE TABLE instructor_claims (
  id TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  submission_id TEXT NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
  instructor_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  website_url TEXT,
  instagram_url TEXT,
  verification_information TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
