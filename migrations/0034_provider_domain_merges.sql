-- Additive identity and rollback journal. No existing listing is removed.
ALTER TABLE providers ADD COLUMN registrable_domain TEXT;
ALTER TABLE providers ADD COLUMN merge_revision INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_provider_domain_status ON providers(registrable_domain,listing_status);
CREATE INDEX idx_offerings_provider_trimmed_name ON offerings(provider_id,lower(trim(name)),listing_status);
CREATE TRIGGER revision_affiliated_instructor AFTER UPDATE ON instructors
BEGIN UPDATE providers SET merge_revision=merge_revision+1 WHERE id IN (SELECT provider_id FROM provider_instructors WHERE instructor_id=NEW.id); END;
CREATE TRIGGER bump_provider_merge_revision AFTER UPDATE ON providers
WHEN NEW.merge_revision=OLD.merge_revision AND (NEW.name IS NOT OLD.name OR NEW.description IS NOT OLD.description OR NEW.teaching_approach IS NOT OLD.teaching_approach OR NEW.website_url IS NOT OLD.website_url OR NEW.instagram_url IS NOT OLD.instagram_url OR NEW.listing_status IS NOT OLD.listing_status OR NEW.claim_status IS NOT OLD.claim_status OR NEW.provider_classification IS NOT OLD.provider_classification OR NEW.listing_type IS NOT OLD.listing_type OR NEW.registrable_domain IS NOT OLD.registrable_domain)
BEGIN UPDATE providers SET merge_revision=OLD.merge_revision+1 WHERE id=NEW.id; END;
CREATE TABLE provider_domains (
  domain TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_provider_domains_provider ON provider_domains(provider_id);
CREATE TABLE provider_merge_events (
  id TEXT PRIMARY KEY,
  submission_id TEXT REFERENCES submissions(id),
  target_provider_id TEXT NOT NULL REFERENCES providers(id),
  source_provider_id TEXT REFERENCES providers(id),
  domain TEXT NOT NULL,
  before_json TEXT NOT NULL,
  incoming_json TEXT NOT NULL,
  resolution_json TEXT NOT NULL,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rolled_back_at TEXT
);
CREATE INDEX idx_provider_merge_target ON provider_merge_events(target_provider_id,created_at);
CREATE TABLE provider_merge_links (
  source_provider_id TEXT PRIMARY KEY REFERENCES providers(id),
  target_provider_id TEXT NOT NULL REFERENCES providers(id),
  source_slug TEXT NOT NULL UNIQUE,
  event_id TEXT NOT NULL REFERENCES provider_merge_events(id),
  CHECK(source_provider_id<>target_provider_id)
);
CREATE INDEX idx_provider_merge_link_target ON provider_merge_links(target_provider_id);
-- Optimistic checks inside the same atomic batch as approval. CHECK failure
-- rolls the entire batch back, including journal and relationship changes.
CREATE TABLE provider_merge_guards (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid=1));
CREATE TABLE provider_preview_jobs (
  provider_id TEXT PRIMARY KEY REFERENCES providers(id),
  website_url TEXT NOT NULL,
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','complete','failed')),
  error TEXT
);
-- Moving a reviewed source's existing offerings must preserve their IDs even
-- if two old records describe the same course. New duplicate inserts stay blocked.
DROP TRIGGER prevent_duplicate_offering_update;
CREATE TRIGGER prevent_duplicate_offering_update
BEFORE UPDATE OF name, provider_id, registration_url, source_url ON offerings
WHEN NEW.provider_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM provider_merge_links m WHERE m.source_provider_id=OLD.provider_id AND m.target_provider_id=NEW.provider_id)
 AND EXISTS(SELECT 1 FROM offerings o WHERE o.id<>NEW.id AND o.listing_status='published' AND o.provider_id=NEW.provider_id
   AND lower(trim(o.name))=lower(trim(NEW.name))
   AND lower(trim(COALESCE(o.registration_url,o.source_url,'')))=lower(trim(COALESCE(NEW.registration_url,NEW.source_url,''))))
BEGIN SELECT RAISE(ABORT,'duplicate_offering_identity'); END;

CREATE TRIGGER revision_offerings_insert AFTER INSERT ON offerings
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_offerings_update AFTER UPDATE ON offerings
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_offerings_delete AFTER DELETE ON offerings
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
END;

CREATE TRIGGER revision_provider_terms_insert AFTER INSERT ON provider_terms
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_provider_terms_update AFTER UPDATE ON provider_terms
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_provider_terms_delete AFTER DELETE ON provider_terms
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
END;

CREATE TRIGGER revision_provider_instructors_insert AFTER INSERT ON provider_instructors
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_provider_instructors_update AFTER UPDATE ON provider_instructors
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_provider_instructors_delete AFTER DELETE ON provider_instructors
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
END;

CREATE TRIGGER revision_provider_locations_insert AFTER INSERT ON provider_locations
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_provider_locations_update AFTER UPDATE ON provider_locations
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_provider_locations_delete AFTER DELETE ON provider_locations
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
END;

CREATE TRIGGER revision_provider_site_urls_insert AFTER INSERT ON provider_site_urls
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_provider_site_urls_update AFTER UPDATE ON provider_site_urls
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_provider_site_urls_delete AFTER DELETE ON provider_site_urls
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
END;

CREATE TRIGGER revision_claims_insert AFTER INSERT ON claims
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_claims_update AFTER UPDATE ON claims
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_claims_delete AFTER DELETE ON claims
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
END;

CREATE TRIGGER revision_provider_update_suggestions_insert AFTER INSERT ON provider_update_suggestions
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_provider_update_suggestions_update AFTER UPDATE ON provider_update_suggestions
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.provider_id;
END;

CREATE TRIGGER revision_provider_update_suggestions_delete AFTER DELETE ON provider_update_suggestions
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.provider_id;
END;

CREATE TRIGGER revision_submissions_insert AFTER INSERT ON submissions
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.duplicate_of_provider_id;
END;

CREATE TRIGGER revision_submissions_update AFTER UPDATE ON submissions
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.duplicate_of_provider_id;
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.duplicate_of_provider_id;
END;

CREATE TRIGGER revision_submissions_delete AFTER DELETE ON submissions
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.duplicate_of_provider_id;
END;

CREATE TRIGGER revision_field_evidence_insert AFTER INSERT ON field_evidence
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.entity_id AND NEW.entity_type='provider';
END;

CREATE TRIGGER revision_field_evidence_update AFTER UPDATE ON field_evidence
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.entity_id AND OLD.entity_type='provider';
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.entity_id AND NEW.entity_type='provider';
END;

CREATE TRIGGER revision_field_evidence_delete AFTER DELETE ON field_evidence
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.entity_id AND OLD.entity_type='provider';
END;

CREATE TRIGGER revision_research_sources_insert AFTER INSERT ON research_sources
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.entity_id AND NEW.entity_type='provider';
END;

CREATE TRIGGER revision_research_sources_update AFTER UPDATE ON research_sources
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.entity_id AND OLD.entity_type='provider';
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=NEW.entity_id AND NEW.entity_type='provider';
END;

CREATE TRIGGER revision_research_sources_delete AFTER DELETE ON research_sources
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id=OLD.entity_id AND OLD.entity_type='provider';
END;
