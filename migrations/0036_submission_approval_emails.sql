-- Future approvals only. Never backfill or email historical submitters.
CREATE TABLE submission_approval_emails (
  submission_id TEXT PRIMARY KEY REFERENCES submissions(id),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','blocked','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_token TEXT,
  provider_message_id TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_approval_emails_status_date ON submission_approval_emails(status,created_at);
