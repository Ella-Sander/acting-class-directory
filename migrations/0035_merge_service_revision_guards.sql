-- Protect guarded rollbacks against later service-evidence and faculty edits.
CREATE TRIGGER merge_revision_offering_instructors_insert AFTER INSERT ON offering_instructors
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id IN (SELECT provider_id FROM offerings WHERE id=NEW.offering_id);
END;
CREATE TRIGGER merge_revision_offering_instructors_update AFTER UPDATE ON offering_instructors
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id IN (SELECT provider_id FROM offerings WHERE id=OLD.offering_id);
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id IN (SELECT provider_id FROM offerings WHERE id=NEW.offering_id);
END;
CREATE TRIGGER merge_revision_offering_instructors_delete AFTER DELETE ON offering_instructors
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id IN (SELECT provider_id FROM offerings WHERE id=OLD.offering_id);
END;
CREATE TRIGGER merge_revision_field_evidence_insert AFTER INSERT ON field_evidence
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id IN (SELECT provider_id FROM offerings WHERE id=NEW.entity_id) AND NEW.entity_type='offering';
END;
CREATE TRIGGER merge_revision_field_evidence_update AFTER UPDATE ON field_evidence
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id IN (SELECT provider_id FROM offerings WHERE id=OLD.entity_id) AND OLD.entity_type='offering';
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id IN (SELECT provider_id FROM offerings WHERE id=NEW.entity_id) AND NEW.entity_type='offering';
END;
CREATE TRIGGER merge_revision_field_evidence_delete AFTER DELETE ON field_evidence
BEGIN
  UPDATE providers SET merge_revision=merge_revision+1 WHERE id IN (SELECT provider_id FROM offerings WHERE id=OLD.entity_id) AND OLD.entity_type='offering';
END;
