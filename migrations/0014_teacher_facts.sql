-- Nullable values mean unknown. Verification remains in the existing evidence
-- table; a submitted value alone never becomes a verified public fact.
ALTER TABLE instructors ADD COLUMN teacher_type TEXT CHECK (teacher_type IN ('independent','institutional') OR teacher_type IS NULL);
ALTER TABLE instructors ADD COLUMN availability_status TEXT CHECK (availability_status IN ('accepting_students','not_accepting_students','waitlist') OR availability_status IS NULL);
ALTER TABLE instructors ADD COLUMN instruction_mode TEXT CHECK (instruction_mode IN ('private','group','both') OR instruction_mode IS NULL);

-- Existing verified "Group Singing Classes" evidence explicitly supports group
-- format. Do not infer private instruction from teacher identity or affiliation.
INSERT OR IGNORE INTO field_evidence(entity_type,entity_id,field_name,verification_status,source_url,verified_at,note)
SELECT 'offering',o.id,'instruction_mode','verified',ot.source_url,ot.verified_at,
  'Group instruction supported by the existing verified Group Singing Classes source. Does not establish current enrollment availability.'
FROM offerings o JOIN offering_terms ot ON ot.offering_id=o.id
JOIN taxonomy_terms tt ON tt.id=ot.term_id
WHERE o.instruction_mode='group' AND tt.slug='group-singing-classes'
AND ot.verification_status='verified' AND ot.source_url IS NOT NULL AND ot.verified_at IS NOT NULL;
