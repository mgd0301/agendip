-- =====================================================================
--  AGENDIP - Migración: historia clínica
--
--  Solo para bases creadas antes de este cambio (las instalaciones
--  nuevas ya lo traen en 01_estructura.sql). Ejecutar una sola vez.
--  En Railway, cambiar "agendia" por "railway".
-- =====================================================================
USE agendia;

ALTER TABLE organizaciones
  ADD COLUMN hc_compartida TINYINT(1) NOT NULL DEFAULT 1
    COMMENT 'Historia clínica: 1 = la ven todos los profesionales, 0 = cada uno solo lo suyo'
    AFTER whatsapp_codigo_pais;

-- Antecedentes del paciente. Cada cambio agrega una versión nueva
-- (se muestra la última), así queda registrado quién cambió qué y cuándo.
CREATE TABLE IF NOT EXISTS hc_antecedentes (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  profesional_id  INT UNSIGNED NOT NULL,
  usuario_id      INT UNSIGNED NULL,
  antecedentes    TEXT NULL COMMENT 'Personales y familiares',
  alergias        TEXT NULL,
  medicacion      TEXT NULL COMMENT 'Medicación habitual',
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hca_pac (paciente_id, id),
  KEY idx_hca_org (organizacion_id),
  KEY idx_hca_prof (profesional_id),
  KEY idx_hca_usr (usuario_id),
  CONSTRAINT fk_hca_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE,
  CONSTRAINT fk_hca_pac FOREIGN KEY (paciente_id)
    REFERENCES pacientes (id) ON DELETE CASCADE,
  CONSTRAINT fk_hca_prof FOREIGN KEY (profesional_id)
    REFERENCES profesionales (id),
  CONSTRAINT fk_hca_usr FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Evolución: lo registrado en cada consulta.
CREATE TABLE IF NOT EXISTS hc_evoluciones (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  profesional_id  INT UNSIGNED NOT NULL,
  usuario_id      INT UNSIGNED NULL,
  turno_id        INT UNSIGNED NULL,
  fecha           DATETIME NOT NULL COMMENT 'Fecha y hora de la consulta',
  motivo          TEXT NULL COMMENT 'Motivo de consulta',
  examen          TEXT NULL COMMENT 'Examen / evaluación',
  diagnostico     TEXT NULL,
  indicaciones    TEXT NULL COMMENT 'Indicaciones / tratamiento',
  editado_en      DATETIME NULL,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hce_pac (paciente_id, fecha),
  KEY idx_hce_org (organizacion_id),
  KEY idx_hce_prof (profesional_id),
  KEY idx_hce_usr (usuario_id),
  KEY idx_hce_turno (turno_id),
  CONSTRAINT fk_hce_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE,
  CONSTRAINT fk_hce_pac FOREIGN KEY (paciente_id)
    REFERENCES pacientes (id) ON DELETE CASCADE,
  CONSTRAINT fk_hce_prof FOREIGN KEY (profesional_id)
    REFERENCES profesionales (id),
  CONSTRAINT fk_hce_usr FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT fk_hce_turno FOREIGN KEY (turno_id)
    REFERENCES turnos (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Aclaraciones agregadas a una evolución ya cerrada (no se edita lo escrito).
CREATE TABLE IF NOT EXISTS hc_aclaraciones (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  evolucion_id   INT UNSIGNED NOT NULL,
  profesional_id INT UNSIGNED NOT NULL,
  usuario_id     INT UNSIGNED NULL,
  texto          TEXT NOT NULL,
  creado_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hcc_evo (evolucion_id),
  KEY idx_hcc_prof (profesional_id),
  KEY idx_hcc_usr (usuario_id),
  CONSTRAINT fk_hcc_evo FOREIGN KEY (evolucion_id)
    REFERENCES hc_evoluciones (id) ON DELETE CASCADE,
  CONSTRAINT fk_hcc_prof FOREIGN KEY (profesional_id)
    REFERENCES profesionales (id),
  CONSTRAINT fk_hcc_usr FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
