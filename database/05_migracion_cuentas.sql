-- =====================================================================
--  AGENDIP - Migración: recuperación de contraseña y cierre de sesiones
--
--  Solo para bases creadas antes de este cambio (las instalaciones
--  nuevas ya lo traen en 01_estructura.sql). Ejecutar una sola vez.
-- =====================================================================
USE agendia;

ALTER TABLE usuarios
  ADD COLUMN sesion_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER ultima_organizacion_id;

-- Pedidos de "olvidé mi contraseña". Se guarda el hash del código enviado por email,
-- nunca el código: quien lea la base no puede usarlo.
CREATE TABLE IF NOT EXISTS recuperaciones_password (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id  INT UNSIGNED NOT NULL,
  token_hash  CHAR(64)     NOT NULL,
  expira      DATETIME     NOT NULL,
  usado_en    DATETIME     NULL,
  creado_en   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_recup_token (token_hash),
  KEY idx_recup_usuario (usuario_id),
  CONSTRAINT fk_recup_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
