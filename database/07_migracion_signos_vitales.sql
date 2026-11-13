-- =====================================================================
--  AGENDIP - Migración: signos vitales y medidas en la historia clínica
--
--  Solo para bases creadas antes de este cambio (las instalaciones
--  nuevas ya lo traen en 01_estructura.sql). Ejecutar una sola vez,
--  después de 06. En Railway, cambiar "agendia" por "railway".
-- =====================================================================
USE agendia;

ALTER TABLE hc_evoluciones
  ADD COLUMN peso               DECIMAL(6,3) NULL COMMENT 'kg' AFTER indicaciones,
  ADD COLUMN talla              DECIMAL(4,1) NULL COMMENT 'cm' AFTER peso,
  ADD COLUMN perimetro_cefalico DECIMAL(4,1) NULL COMMENT 'cm' AFTER talla,
  ADD COLUMN temperatura        DECIMAL(3,1) NULL COMMENT '°C' AFTER perimetro_cefalico,
  ADD COLUMN ta_sistolica       SMALLINT UNSIGNED NULL COMMENT 'mmHg' AFTER temperatura,
  ADD COLUMN ta_diastolica      SMALLINT UNSIGNED NULL COMMENT 'mmHg' AFTER ta_sistolica,
  ADD COLUMN frec_cardiaca      SMALLINT UNSIGNED NULL COMMENT 'lpm' AFTER ta_diastolica,
  ADD COLUMN frec_respiratoria  SMALLINT UNSIGNED NULL COMMENT 'rpm' AFTER frec_cardiaca,
  ADD COLUMN saturacion         TINYINT UNSIGNED NULL COMMENT '% SpO2' AFTER frec_respiratoria;

-- Qué signos vitales y medidas usa cada profesional en sus evoluciones
-- (ninguno por defecto; cada uno los elige desde la historia clínica).
ALTER TABLE profesionales
  ADD COLUMN hc_medidas VARCHAR(255) NULL
    COMMENT 'Historia clínica: signos vitales y medidas que usa, separados por coma'
    AFTER duracion_turno_min;
