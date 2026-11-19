-- Translate the existing reviewed provider categories to the new vocabulary.
-- A school was explicitly stored as a school; a studio as a studio. Coaches
-- (if any are added later) stay unconfirmed pending evidence of a distinct
-- independently operated practice.
UPDATE providers
SET provider_classification = CASE listing_type
  WHEN 'school' THEN 'institution'
  WHEN 'studio' THEN 'studio_business'
  ELSE 'unconfirmed'
END,
updated_at = CURRENT_TIMESTAMP
WHERE listing_status = 'published'
  AND provider_classification IS NULL;

-- Capture existing published official website fields without flattening paths
-- to hostnames. The official source rows are already verified in research_sources.
-- Host casing and www are normalized; path casing is preserved and a final slash
-- is removed. Shared domains remain allowed across different providers.
WITH source_urls AS (
  SELECT id AS provider_id,
         website_url AS url,
         lower(substr(website_url, 1, instr(website_url, '://') + 2)) AS scheme,
         substr(website_url, instr(website_url, '://') + 3) AS remainder
  FROM providers
  WHERE listing_status = 'published'
    AND website_url IS NOT NULL
    AND instr(website_url, '://') > 0
), url_parts AS (
  SELECT provider_id, url, scheme,
         substr(remainder, 1, instr(remainder || '/', '/') - 1) AS host,
         substr(remainder, instr(remainder || '/', '/')) AS path
  FROM source_urls
)
INSERT OR IGNORE INTO provider_site_urls
  (id, provider_id, url, normalized_url, url_role, is_primary,
   verification_status, source_url, verified_at)
SELECT 'provider-site-' || up.provider_id,
       up.provider_id,
       up.url,
       up.scheme || replace(lower(up.host), 'www.', '') ||
         CASE WHEN up.path = '/' THEN '' ELSE rtrim(up.path, '/') END,
       'official',
       1,
       'verified',
       (SELECT rs.source_url FROM research_sources rs
        WHERE rs.entity_type = 'provider'
          AND rs.entity_id = up.provider_id
          AND rs.source_url = up.url
          AND rs.verification_status = 'verified'
        ORDER BY rs.checked_at DESC LIMIT 1),
       (SELECT MAX(rs.checked_at) FROM research_sources rs
        WHERE rs.entity_type = 'provider'
          AND rs.entity_id = up.provider_id
          AND rs.source_url = up.url
          AND rs.verification_status = 'verified')
FROM url_parts up
WHERE EXISTS (
  SELECT 1 FROM research_sources rs
  WHERE rs.entity_type = 'provider'
    AND rs.entity_id = up.provider_id
    AND rs.source_url = up.url
    AND rs.verification_status = 'verified'
);
