-- Additive indexes for public submission duplicate validation. No data changes.
CREATE INDEX IF NOT EXISTS idx_instructors_duplicate_name_site
  ON instructors(lower(name), website_url);
CREATE INDEX IF NOT EXISTS idx_offerings_duplicate_provider_name
  ON offerings(provider_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_claims_submission ON claims(submission_id);
CREATE INDEX IF NOT EXISTS idx_claims_provider ON claims(provider_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_submission ON provider_update_suggestions(submission_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_provider ON provider_update_suggestions(provider_id);
CREATE INDEX IF NOT EXISTS idx_submissions_duplicate_provider ON submissions(duplicate_of_provider_id);
CREATE INDEX IF NOT EXISTS idx_instructor_claims_instructor ON instructor_claims(instructor_id);
CREATE INDEX IF NOT EXISTS idx_provider_redirects_provider ON provider_url_redirects(target_provider_id);
