-- Imports and reviewed submissions may add separate businesses on a shared
-- domain. Block only an exact repeated provider/person/class identity; never
-- use hostname equality as a provider merge key.
CREATE TRIGGER prevent_duplicate_provider_import
BEFORE INSERT ON providers
WHEN NEW.website_url IS NOT NULL AND EXISTS (
  SELECT 1 FROM providers p
  WHERE p.listing_status='published'
    AND lower(trim(p.name))=lower(trim(NEW.name))
    AND lower(trim(p.website_url))=lower(trim(NEW.website_url))
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate_provider_identity');
END;

CREATE TRIGGER prevent_duplicate_provider_update
BEFORE UPDATE OF name, website_url ON providers
WHEN NEW.website_url IS NOT NULL AND EXISTS (
  SELECT 1 FROM providers p
  WHERE p.id<>NEW.id AND p.listing_status='published'
    AND lower(trim(p.name))=lower(trim(NEW.name))
    AND lower(trim(p.website_url))=lower(trim(NEW.website_url))
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate_provider_identity');
END;

CREATE TRIGGER prevent_duplicate_teacher_import
BEFORE INSERT ON instructors
WHEN NEW.website_url IS NOT NULL AND EXISTS (
  SELECT 1 FROM instructors i
  WHERE i.profile_status='published'
    AND lower(trim(i.name))=lower(trim(NEW.name))
    AND lower(trim(i.website_url))=lower(trim(NEW.website_url))
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate_teacher_identity');
END;

CREATE TRIGGER prevent_duplicate_teacher_update
BEFORE UPDATE OF name, website_url ON instructors
WHEN NEW.website_url IS NOT NULL AND EXISTS (
  SELECT 1 FROM instructors i
  WHERE i.id<>NEW.id AND i.profile_status='published'
    AND lower(trim(i.name))=lower(trim(NEW.name))
    AND lower(trim(i.website_url))=lower(trim(NEW.website_url))
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate_teacher_identity');
END;

CREATE TRIGGER prevent_duplicate_offering_import
BEFORE INSERT ON offerings
WHEN NEW.provider_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM offerings o
  WHERE o.listing_status='published' AND o.provider_id=NEW.provider_id
    AND lower(trim(o.name))=lower(trim(NEW.name))
    AND lower(trim(COALESCE(o.registration_url,o.source_url,'')))
      =lower(trim(COALESCE(NEW.registration_url,NEW.source_url,'')))
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate_offering_identity');
END;

CREATE TRIGGER prevent_duplicate_offering_update
BEFORE UPDATE OF name, provider_id, registration_url, source_url ON offerings
WHEN NEW.provider_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM offerings o
  WHERE o.id<>NEW.id AND o.listing_status='published' AND o.provider_id=NEW.provider_id
    AND lower(trim(o.name))=lower(trim(NEW.name))
    AND lower(trim(COALESCE(o.registration_url,o.source_url,'')))
      =lower(trim(COALESCE(NEW.registration_url,NEW.source_url,'')))
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate_offering_identity');
END;
