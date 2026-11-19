-- Pending duplicate checks are submitted with normalized email and type.
-- This partial expression index avoids scanning the full submissions history.
CREATE INDEX IF NOT EXISTS idx_submissions_pending_contact_type
  ON submissions(lower(contact_email), COALESCE(json_extract(payload_json, '$.type'), submission_type))
  WHERE status = 'pending';
