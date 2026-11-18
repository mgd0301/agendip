-- =====================================================================
--  AGENDIP - Migración: turnos virtuales
--
--  Solo para bases creadas antes de este cambio (las instalaciones
--  nuevas ya lo traen en 01_estructura.sql). Ejecutar una sola vez.
--  En Railway, cambiar "agendia" por "railway".
-- =====================================================================
USE agendia;

ALTER TABLE turnos
  ADD COLUMN es_virtual TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Consulta virtual (videollamada)'
    AFTER sobreturno;
