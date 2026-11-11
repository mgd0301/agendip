-- =====================================================================
--  AGENDIP - Migración: obras sociales con planes
--
--  Solo para bases creadas antes de este cambio (las instalaciones
--  nuevas ya lo traen en 01_estructura.sql). Ejecutar una sola vez,
--  después de 01_estructura.sql, que crea las tablas obras_sociales y
--  obras_sociales_planes.
--
--  Pasa el texto libre pacientes.obra_social a la tabla obras_sociales
--  y lo reemplaza por una referencia.
-- =====================================================================
USE agendia;

ALTER TABLE pacientes
  ADD COLUMN obra_social_id INT UNSIGNED NULL AFTER direccion,
  ADD COLUMN plan_id        INT UNSIGNED NULL AFTER obra_social_id;

-- Una obra social por cada nombre distinto ya cargado en los pacientes.
INSERT IGNORE INTO obras_sociales (organizacion_id, nombre)
SELECT DISTINCT organizacion_id, TRIM(obra_social)
  FROM pacientes
 WHERE obra_social IS NOT NULL AND TRIM(obra_social) <> '';

UPDATE pacientes p
  JOIN obras_sociales os
    ON os.organizacion_id = p.organizacion_id AND os.nombre = TRIM(p.obra_social)
   SET p.obra_social_id = os.id;

ALTER TABLE pacientes
  DROP COLUMN obra_social,
  ADD KEY idx_pac_os (obra_social_id),
  ADD KEY idx_pac_plan (plan_id),
  ADD CONSTRAINT fk_pac_os FOREIGN KEY (obra_social_id)
    REFERENCES obras_sociales (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_pac_plan FOREIGN KEY (plan_id)
    REFERENCES obras_sociales_planes (id) ON DELETE SET NULL;
