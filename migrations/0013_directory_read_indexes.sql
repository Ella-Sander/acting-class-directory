-- Additive only: reverse lookups previously revisited every published provider
-- and offering for each instructor. Existing primary keys cover the other side.
CREATE INDEX IF NOT EXISTS idx_provider_instructors_instructor
  ON provider_instructors(instructor_id, provider_id);
CREATE INDEX IF NOT EXISTS idx_offering_instructors_instructor
  ON offering_instructors(instructor_id, offering_id);

-- Cover verification lookups and MAX(verified_at) without reading evidence rows.
CREATE INDEX IF NOT EXISTS idx_field_evidence_verified_entity_date
  ON field_evidence(entity_type, entity_id, verification_status, verified_at DESC, field_name);

-- Match the public result order without a temporary NOCASE sort.
CREATE INDEX IF NOT EXISTS idx_instructors_public_name
  ON instructors(profile_status, name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_providers_public_name
  ON providers(listing_status, name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_offerings_public_name
  ON offerings(listing_status, name COLLATE NOCASE);
