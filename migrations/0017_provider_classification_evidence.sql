-- Record source provenance for the explicit school/studio classifications
-- translated by migration 0016. Unknown or future coach providers remain
-- unconfirmed until reviewed evidence is available.
INSERT OR IGNORE INTO field_evidence
  (entity_type, entity_id, field_name, verification_status, source_url, verified_at, note)
SELECT 'provider', p.id, 'provider_classification', 'verified', rs.source_url,
       rs.checked_at,
       'Existing reviewed provider listing type translated to the provider classification vocabulary and supported by its verified official source.'
FROM providers p
JOIN research_sources rs
  ON rs.entity_type='provider'
 AND rs.entity_id=p.id
 AND rs.source_url=p.website_url
 AND rs.verification_status='verified'
WHERE p.listing_status='published'
  AND p.provider_classification IN ('institution','studio_business');
