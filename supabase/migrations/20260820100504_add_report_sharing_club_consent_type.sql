-- Nuevo tipo de consentimiento: compartir el informe con el club (bloqueante en equipos).
-- Amplía el CHECK de consent_versions.type y consents.type.
-- (El seed de la fila consent_versions y la reescritura del texto de data_processing se
--  hacen como datos, no en esta migración de esquema.)

ALTER TABLE consent_versions DROP CONSTRAINT IF EXISTS consent_versions_type_check;
ALTER TABLE consent_versions ADD CONSTRAINT consent_versions_type_check
  CHECK (type IN ('data_processing','info_treatment','ai_analysis','image_rights','report_sharing_club'));

ALTER TABLE consents DROP CONSTRAINT IF EXISTS consents_type_check;
ALTER TABLE consents ADD CONSTRAINT consents_type_check
  CHECK (type IN ('data_processing','info_treatment','ai_analysis','image_rights','report_sharing_club'));
