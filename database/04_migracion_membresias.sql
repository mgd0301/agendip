-- =====================================================================
--  AGENDIP - Migración: usuarios en varias organizaciones y superadmin
--
--  Solo para bases creadas antes de este cambio (las instalaciones
--  nuevas ya lo traen en 01_estructura.sql). Ejecutar una sola vez.
--
--  El rol, el profesional vinculado y el permiso de sobreturno de cada
--  usuario pasan a su membresía en la organización a la que pertenecía.
-- =====================================================================
USE agendia;

CREATE TABLE IF NOT EXISTS membresias (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id       INT UNSIGNED NOT NULL,
  organizacion_id  INT UNSIGNED NOT NULL,
  rol              ENUM('admin','recepcion','profesional') NOT NULL DEFAULT 'recepcion',
  profesional_id   INT UNSIGNED NULL COMMENT 'Profesional vinculado (rol profesional)',
  puede_sobreturno TINYINT(1)   NOT NULL DEFAULT 0,
  activo           TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_memb (usuario_id, organizacion_id),
  KEY idx_memb_org (organizacion_id),
  KEY idx_memb_prof (profesional_id),
  CONSTRAINT fk_memb_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_memb_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE,
  CONSTRAINT fk_memb_prof FOREIGN KEY (profesional_id)
    REFERENCES profesionales (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT IGNORE INTO membresias (usuario_id, organizacion_id, rol, profesional_id, puede_sobreturno, activo)
SELECT id, organizacion_id, rol, profesional_id, puede_sobreturno, activo
  FROM usuarios;

-- La cuenta queda activa: la baja pasa a ser por organización, en la membresía.
UPDATE usuarios SET activo = 1;

-- MySQL 5.0 no permite borrar dos claves foráneas en el mismo ALTER.
ALTER TABLE usuarios DROP FOREIGN KEY fk_usuarios_org;
ALTER TABLE usuarios DROP FOREIGN KEY fk_usuarios_prof;

ALTER TABLE usuarios
  DROP COLUMN organizacion_id,
  DROP COLUMN rol,
  DROP COLUMN profesional_id,
  DROP COLUMN puede_sobreturno,
  ADD COLUMN es_superadmin TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash,
  ADD COLUMN ultima_organizacion_id INT UNSIGNED NULL AFTER es_superadmin;
