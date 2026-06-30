-- Normalize legacy position rows so their scope matches the bound organization.
UPDATE person_positions AS position
SET
  position_scope = organization.level,
  updated_at = NOW()
FROM organizations AS organization
WHERE organization.id = position.org_id
  AND position.position_scope IS DISTINCT FROM organization.level;
