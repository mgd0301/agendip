-- =====================================================================
--  AGENDIP - Gestión de agendas y turnos profesionales
--  Script de estructura de base de datos
--
--  Compatible con MySQL 5.0 o superior.
--  Consideraciones de compatibilidad con 5.0:
--    * Charset utf8 (utf8mb4 no existe en 5.0: no se admiten emojis).
--    * Un solo TIMESTAMP con DEFAULT CURRENT_TIMESTAMP por tabla;
--      el resto de las fechas son DATETIME y las completa la aplicación.
--    * Sin tipo JSON, sin columnas generadas, sin EVENTS ni triggers.
--    * Motor InnoDB para claves foráneas y transacciones.
--
--  El script es re-ejecutable: usa CREATE TABLE IF NOT EXISTS.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS agendia
  DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci;

USE agendia;
SET NAMES utf8;

-- ---------------------------------------------------------------------
--  ORGANIZACIONES (cada consultorio / centro / profesional independiente)
--  Todos los datos del sistema cuelgan de una organización.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizaciones (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre               VARCHAR(150) NOT NULL,
  tipo                 ENUM('consultorio','centro','profesional_independiente') NOT NULL DEFAULT 'consultorio',
  email                VARCHAR(150) NULL,
  telefono             VARCHAR(50)  NULL,
  direccion            VARCHAR(255) NULL,
  whatsapp_codigo_pais VARCHAR(6)   NOT NULL DEFAULT '549' COMMENT 'Prefijo para links de WhatsApp (549 = Argentina celulares)',
  plan                 VARCHAR(30)  NOT NULL DEFAULT 'basico',
  max_profesionales    INT UNSIGNED NULL COMMENT 'NULL = sin límite',
  activo               TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ---------------------------------------------------------------------
--  SEDES (preparado para múltiples sedes - etapa 4)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sedes (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id INT UNSIGNED NOT NULL,
  nombre          VARCHAR(120) NOT NULL,
  direccion       VARCHAR(255) NULL,
  telefono        VARCHAR(50)  NULL,
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sedes_org (organizacion_id),
  CONSTRAINT fk_sedes_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ---------------------------------------------------------------------
--  PROFESIONALES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profesionales (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id    INT UNSIGNED NOT NULL,
  nombre             VARCHAR(100) NOT NULL,
  apellido           VARCHAR(100) NOT NULL,
  especialidad       VARCHAR(120) NULL,
  matricula          VARCHAR(50)  NULL,
  email              VARCHAR(150) NULL,
  telefono           VARCHAR(50)  NULL,
  color              VARCHAR(7)   NOT NULL DEFAULT '#2563eb',
  duracion_turno_min SMALLINT UNSIGNED NOT NULL DEFAULT 30 COMMENT 'Duración predeterminada / tamaño de bloque',
  activo             TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_prof_org (organizacion_id, activo),
  CONSTRAINT fk_prof_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ---------------------------------------------------------------------
--  USUARIOS (acceso al sistema, por organización)
--  rol: admin | recepcion | profesional
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id  INT UNSIGNED NOT NULL,
  nombre           VARCHAR(150) NOT NULL,
  email            VARCHAR(150) NOT NULL,
  password_hash    VARCHAR(100) NOT NULL,
  rol              ENUM('admin','recepcion','profesional') NOT NULL DEFAULT 'recepcion',
  profesional_id   INT UNSIGNED NULL COMMENT 'Profesional vinculado (rol profesional)',
  puede_sobreturno TINYINT(1)   NOT NULL DEFAULT 0,
  activo           TINYINT(1)   NOT NULL DEFAULT 1,
  ultimo_acceso    DATETIME     NULL,
  creado_en        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usuarios_email (email),
  KEY idx_usuarios_org (organizacion_id),
  KEY idx_usuarios_prof (profesional_id),
  CONSTRAINT fk_usuarios_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE,
  CONSTRAINT fk_usuarios_prof FOREIGN KEY (profesional_id)
    REFERENCES profesionales (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ---------------------------------------------------------------------
--  PRESTACIONES (tipos de atención)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prestaciones (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id INT UNSIGNED NOT NULL,
  nombre          VARCHAR(120) NOT NULL,
  descripcion     VARCHAR(255) NULL,
  duracion_min    SMALLINT UNSIGNED NULL COMMENT 'Duración sugerida',
  precio          DECIMAL(12,2) NULL COMMENT 'Preparado para aranceles (etapa posterior)',
  color           VARCHAR(7)   NULL,
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_prest_org (organizacion_id, activo),
  CONSTRAINT fk_prest_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Duración específica de una prestación para un profesional (opcional)
CREATE TABLE IF NOT EXISTS profesional_prestacion (
  profesional_id INT UNSIGNED NOT NULL,
  prestacion_id  INT UNSIGNED NOT NULL,
  duracion_min   SMALLINT UNSIGNED NULL,
  PRIMARY KEY (profesional_id, prestacion_id),
  KEY idx_pp_prest (prestacion_id),
  CONSTRAINT fk_pp_prof FOREIGN KEY (profesional_id)
    REFERENCES profesionales (id) ON DELETE CASCADE,
  CONSTRAINT fk_pp_prest FOREIGN KEY (prestacion_id)
    REFERENCES prestaciones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ---------------------------------------------------------------------
--  PACIENTES (compartidos entre los profesionales de la organización)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pacientes (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id  INT UNSIGNED NOT NULL,
  nombre           VARCHAR(100) NOT NULL,
  apellido         VARCHAR(100) NOT NULL,
  dni              VARCHAR(20)  NULL,
  fecha_nacimiento DATE         NULL,
  sexo             ENUM('F','M','X') NULL,
  telefono         VARCHAR(50)  NULL,
  email            VARCHAR(150) NULL,
  direccion        VARCHAR(255) NULL,
  obra_social      VARCHAR(120) NULL,
  nro_afiliado     VARCHAR(60)  NULL,
  observaciones    TEXT         NULL,
  activo           TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pacientes_dni (organizacion_id, dni),
  KEY idx_pac_apellido (organizacion_id, apellido, nombre),
  KEY idx_pac_tel (organizacion_id, telefono),
  CONSTRAINT fk_pac_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Campos adicionales configurables por organización
CREATE TABLE IF NOT EXISTS campos_paciente (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id INT UNSIGNED NOT NULL,
  nombre          VARCHAR(80)  NOT NULL,
  tipo            ENUM('texto','numero','fecha','opcion','si_no') NOT NULL DEFAULT 'texto',
  opciones        TEXT         NULL COMMENT 'Para tipo opcion: valores separados por |',
  orden           SMALLINT     NOT NULL DEFAULT 0,
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_cp_org (organizacion_id),
  CONSTRAINT fk_cp_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS paciente_valores (
  paciente_id INT UNSIGNED NOT NULL,
  campo_id    INT UNSIGNED NOT NULL,
  valor       TEXT NULL,
  PRIMARY KEY (paciente_id, campo_id),
  KEY idx_pv_campo (campo_id),
  CONSTRAINT fk_pv_pac FOREIGN KEY (paciente_id)
    REFERENCES pacientes (id) ON DELETE CASCADE,
  CONSTRAINT fk_pv_campo FOREIGN KEY (campo_id)
    REFERENCES campos_paciente (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ---------------------------------------------------------------------
--  HORARIO HABITUAL (franjas recurrentes por día de semana)
--  dia_semana: 0 = domingo ... 6 = sábado. Puede haber varias franjas por día.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horarios (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  profesional_id INT UNSIGNED NOT NULL,
  sede_id        INT UNSIGNED NULL,
  dia_semana     TINYINT UNSIGNED NOT NULL,
  hora_desde     TIME NOT NULL,
  hora_hasta     TIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_horarios_prof (profesional_id, dia_semana),
  KEY idx_horarios_sede (sede_id),
  CONSTRAINT fk_horarios_prof FOREIGN KEY (profesional_id)
    REFERENCES profesionales (id) ON DELETE CASCADE,
  CONSTRAINT fk_horarios_sede FOREIGN KEY (sede_id)
    REFERENCES sedes (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ---------------------------------------------------------------------
--  EXCEPCIONES (prevalecen sobre el horario habitual)
--  profesional_id NULL = aplica a toda la organización (ej: feriado).
--  tipo horario_especial: reemplaza el horario habitual de esas fechas.
--  Resto de tipos: bloquean el día completo (horas NULL) o la franja indicada.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS excepciones (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id INT UNSIGNED NOT NULL,
  profesional_id  INT UNSIGNED NULL,
  tipo            ENUM('feriado','vacaciones','licencia','dia_libre','bloqueo','horario_especial') NOT NULL,
  fecha_desde     DATE NOT NULL,
  fecha_hasta     DATE NOT NULL,
  hora_desde      TIME NULL,
  hora_hasta      TIME NULL,
  motivo          VARCHAR(255) NULL,
  creado_por      INT UNSIGNED NULL,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_exc_rango (organizacion_id, fecha_desde, fecha_hasta),
  KEY idx_exc_prof (profesional_id),
  KEY idx_exc_usr (creado_por),
  CONSTRAINT fk_exc_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE,
  CONSTRAINT fk_exc_prof FOREIGN KEY (profesional_id)
    REFERENCES profesionales (id) ON DELETE CASCADE,
  CONSTRAINT fk_exc_usr FOREIGN KEY (creado_por)
    REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ---------------------------------------------------------------------
--  CONFIGURACIÓN VISUAL DE ESTADOS DE TURNO (colores / etiquetas)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estados_config (
  organizacion_id INT UNSIGNED NOT NULL,
  estado          ENUM('pendiente','confirmado','atendido','ausente','cancelado') NOT NULL,
  etiqueta        VARCHAR(40) NOT NULL,
  color           VARCHAR(7)  NOT NULL,
  PRIMARY KEY (organizacion_id, estado),
  CONSTRAINT fk_estc_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ---------------------------------------------------------------------
--  SERIES DE TURNOS RECURRENTES (preparado - etapa 3)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS turnos_series (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id INT UNSIGNED NOT NULL,
  profesional_id  INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  prestacion_id   INT UNSIGNED NULL,
  frecuencia      ENUM('semanal','quincenal','mensual') NOT NULL DEFAULT 'semanal',
  hora_inicio     TIME NOT NULL,
  duracion_min    SMALLINT UNSIGNED NOT NULL,
  fecha_desde     DATE NOT NULL,
  fecha_hasta     DATE NULL,
  cantidad        SMALLINT UNSIGNED NULL,
  creado_por      INT UNSIGNED NULL,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ser_org (organizacion_id),
  KEY idx_ser_prof (profesional_id),
  KEY idx_ser_pac (paciente_id),
  KEY idx_ser_prest (prestacion_id),
  CONSTRAINT fk_ser_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE,
  CONSTRAINT fk_ser_prof FOREIGN KEY (profesional_id)
    REFERENCES profesionales (id) ON DELETE CASCADE,
  CONSTRAINT fk_ser_pac FOREIGN KEY (paciente_id)
    REFERENCES pacientes (id) ON DELETE CASCADE,
  CONSTRAINT fk_ser_prest FOREIGN KEY (prestacion_id)
    REFERENCES prestaciones (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ---------------------------------------------------------------------
--  TURNOS
--  Se guarda inicio, fin y duración: la agenda dibuja la duración real
--  sin depender de bloques fijos. Superposición: inicio < fin2 AND fin > inicio2.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS turnos (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id    INT UNSIGNED NOT NULL,
  profesional_id     INT UNSIGNED NOT NULL,
  paciente_id        INT UNSIGNED NOT NULL,
  prestacion_id      INT UNSIGNED NULL,
  sede_id            INT UNSIGNED NULL,
  serie_id           INT UNSIGNED NULL,
  inicio             DATETIME NOT NULL,
  fin                DATETIME NOT NULL,
  duracion_min       SMALLINT UNSIGNED NOT NULL,
  estado             ENUM('pendiente','confirmado','atendido','ausente','cancelado') NOT NULL DEFAULT 'pendiente',
  sobreturno         TINYINT(1) NOT NULL DEFAULT 0,
  observaciones      TEXT NULL,
  motivo_cancelacion VARCHAR(255) NULL,
  creado_por         INT UNSIGNED NULL,
  actualizado_por    INT UNSIGNED NULL,
  actualizado_en     DATETIME NULL,
  creado_en          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_turnos_prof_inicio (profesional_id, inicio),
  KEY idx_turnos_org_inicio (organizacion_id, inicio),
  KEY idx_turnos_pac (paciente_id, inicio),
  KEY idx_turnos_estado (organizacion_id, estado),
  KEY idx_turnos_prest (prestacion_id),
  KEY idx_turnos_sede (sede_id),
  KEY idx_turnos_serie (serie_id),
  KEY idx_turnos_creado (creado_por),
  KEY idx_turnos_act (actualizado_por),
  CONSTRAINT fk_turnos_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE,
  CONSTRAINT fk_turnos_prof FOREIGN KEY (profesional_id)
    REFERENCES profesionales (id),
  CONSTRAINT fk_turnos_pac FOREIGN KEY (paciente_id)
    REFERENCES pacientes (id),
  CONSTRAINT fk_turnos_prest FOREIGN KEY (prestacion_id)
    REFERENCES prestaciones (id) ON DELETE SET NULL,
  CONSTRAINT fk_turnos_sede FOREIGN KEY (sede_id)
    REFERENCES sedes (id) ON DELETE SET NULL,
  CONSTRAINT fk_turnos_serie FOREIGN KEY (serie_id)
    REFERENCES turnos_series (id) ON DELETE SET NULL,
  CONSTRAINT fk_turnos_creado FOREIGN KEY (creado_por)
    REFERENCES usuarios (id) ON DELETE SET NULL,
  CONSTRAINT fk_turnos_act FOREIGN KEY (actualizado_por)
    REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Historial de cambios de cada turno (trazabilidad)
CREATE TABLE IF NOT EXISTS turno_historial (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  turno_id         INT UNSIGNED NOT NULL,
  usuario_id       INT UNSIGNED NULL,
  accion           ENUM('creado','modificado','reprogramado','estado','cancelado','mensaje') NOT NULL,
  detalle          VARCHAR(500) NULL,
  datos_anteriores TEXT NULL COMMENT 'Snapshot JSON (texto) previo al cambio',
  fecha            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hist_turno (turno_id, fecha),
  KEY idx_hist_usr (usuario_id),
  CONSTRAINT fk_hist_turno FOREIGN KEY (turno_id)
    REFERENCES turnos (id) ON DELETE CASCADE,
  CONSTRAINT fk_hist_usr FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ---------------------------------------------------------------------
--  LISTA DE ESPERA (preparado - etapa 3)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lista_espera (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id INT UNSIGNED NOT NULL,
  paciente_id     INT UNSIGNED NOT NULL,
  profesional_id  INT UNSIGNED NULL,
  prestacion_id   INT UNSIGNED NULL,
  preferencia     VARCHAR(255) NULL COMMENT 'Días / horarios preferidos',
  estado          ENUM('activo','asignado','descartado') NOT NULL DEFAULT 'activo',
  turno_id        INT UNSIGNED NULL,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_le_org (organizacion_id, estado),
  KEY idx_le_pac (paciente_id),
  KEY idx_le_prof (profesional_id),
  KEY idx_le_prest (prestacion_id),
  KEY idx_le_turno (turno_id),
  CONSTRAINT fk_le_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE,
  CONSTRAINT fk_le_pac FOREIGN KEY (paciente_id)
    REFERENCES pacientes (id) ON DELETE CASCADE,
  CONSTRAINT fk_le_prof FOREIGN KEY (profesional_id)
    REFERENCES profesionales (id) ON DELETE SET NULL,
  CONSTRAINT fk_le_prest FOREIGN KEY (prestacion_id)
    REFERENCES prestaciones (id) ON DELETE SET NULL,
  CONSTRAINT fk_le_turno FOREIGN KEY (turno_id)
    REFERENCES turnos (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- ---------------------------------------------------------------------
--  COMUNICACIONES
-- ---------------------------------------------------------------------
-- Plantillas de mensajes. Variables disponibles:
--   {paciente} {paciente_nombre} {profesional} {prestacion}
--   {fecha} {dia} {hora} {organizacion} {direccion} {telefono}
CREATE TABLE IF NOT EXISTS plantillas_mensaje (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id INT UNSIGNED NOT NULL,
  tipo            ENUM('confirmacion','recordatorio','cancelacion','reprogramacion') NOT NULL,
  canal           ENUM('whatsapp','email') NOT NULL,
  asunto          VARCHAR(200) NULL,
  cuerpo          TEXT NOT NULL,
  activo          TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uk_plantilla (organizacion_id, tipo, canal),
  CONSTRAINT fk_plant_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Registro de envíos (manuales y automáticos). Permite evitar duplicados.
CREATE TABLE IF NOT EXISTS notificaciones (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  organizacion_id INT UNSIGNED NOT NULL,
  turno_id        INT UNSIGNED NULL,
  canal           ENUM('whatsapp','email') NOT NULL,
  tipo            ENUM('confirmacion','recordatorio','cancelacion','reprogramacion') NOT NULL,
  destinatario    VARCHAR(150) NOT NULL,
  mensaje         TEXT NULL,
  estado          ENUM('pendiente','enviado','error','manual') NOT NULL DEFAULT 'pendiente',
  error           VARCHAR(500) NULL,
  programado_para DATETIME NULL,
  enviado_en      DATETIME NULL,
  usuario_id      INT UNSIGNED NULL,
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_not_turno (turno_id, canal, tipo),
  KEY idx_not_pend (estado, programado_para),
  KEY idx_not_org (organizacion_id),
  KEY idx_not_usr (usuario_id),
  CONSTRAINT fk_not_org FOREIGN KEY (organizacion_id)
    REFERENCES organizaciones (id) ON DELETE CASCADE,
  CONSTRAINT fk_not_turno FOREIGN KEY (turno_id)
    REFERENCES turnos (id) ON DELETE SET NULL,
  CONSTRAINT fk_not_usr FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
