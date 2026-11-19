ALTER TABLE providers ADD COLUMN metadata_image_url TEXT;
ALTER TABLE providers ADD COLUMN metadata_image_source_url TEXT;
ALTER TABLE providers ADD COLUMN metadata_image_type TEXT CHECK (metadata_image_type IN ('og:image','twitter:image','none'));
ALTER TABLE providers ADD COLUMN metadata_image_checked_at TEXT;
