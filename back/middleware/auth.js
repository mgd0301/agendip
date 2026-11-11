const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { HttpError, forbidden } = require('../utils/http');

// El token identifica la cuenta (id) y la organización en la que está trabajando (org).
// Una cuenta puede tener acceso a varias organizaciones, cada una con su rol (tabla membresias).
async function leerToken(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Sesión no iniciada');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Sesión vencida, vuelva a ingresar');
  }

  const [cuenta] = await query(
    'SELECT id, nombre, email, es_superadmin, sesion_version FROM usuarios WHERE id = ? AND activo = 1',
    [payload.id]
  );
  if (!cuenta) throw new HttpError(401, 'Usuario inactivo');
  // Al cambiar la contraseña sube la versión: los tokens anteriores dejan de valer.
  if (Number(payload.v || 0) !== Number(cuenta.sesion_version)) throw new HttpError(401, 'La sesión se cerró, vuelva a ingresar');
  cuenta.es_superadmin = Number(cuenta.es_superadmin) === 1;
  return { cuenta, orgId: payload.org || null };
}

// Rol de la cuenta en una organización, o null si no tiene acceso.
// El superadministrador entra a cualquier organización como admin.
async function membresia(cuenta, orgId) {
  if (!orgId) return null;
  const [m] = await query(
    `SELECT m.rol, m.profesional_id, m.puede_sobreturno
       FROM membresias m JOIN organizaciones o ON o.id = m.organizacion_id
      WHERE m.usuario_id = ? AND m.organizacion_id = ? AND m.activo = 1 AND o.activo = 1`,
    [cuenta.id, orgId]
  );
  if (m) return m;
  if (!cuenta.es_superadmin) return null;
  const [o] = await query('SELECT id FROM organizaciones WHERE id = ?', [orgId]);
  return o ? { rol: 'admin', profesional_id: null, puede_sobreturno: 1 } : null;
}

// Rutas de una organización: requiere estar trabajando en una a la que se tenga acceso.
async function auth(req, res, next) {
  const { cuenta, orgId } = await leerToken(req);
  if (!orgId) throw new HttpError(403, 'Elija un consultorio para continuar', 'SIN_ORGANIZACION');
  const m = await membresia(cuenta, orgId);
  if (!m) throw new HttpError(401, 'Ya no tiene acceso a este consultorio');

  req.cuenta = cuenta;
  req.user = { ...cuenta, ...m, organizacion_id: Number(orgId) };
  req.orgId = Number(orgId);
  next();
}

// Rutas de la cuenta (perfil, contraseña, cambio de organización): no requieren organización.
async function authCuenta(req, res, next) {
  const { cuenta, orgId } = await leerToken(req);
  req.cuenta = cuenta;
  req.tokenOrg = orgId;
  next();
}

const soloSuperadmin = (req, res, next) => (req.cuenta?.es_superadmin ? next() : next(forbidden()));

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.rol) ? next() : next(forbidden());

// Un usuario con rol "profesional" solo opera sobre su propia agenda.
function puedeOperarProfesional(user, profesionalId) {
  if (user.rol !== 'profesional') return true;
  return Number(user.profesional_id) === Number(profesionalId);
}

function assertProfesional(user, profesionalId) {
  if (!puedeOperarProfesional(user, profesionalId)) {
    throw forbidden('Solo puede operar sobre su propia agenda');
  }
}

const puedeSobreturno = (user) => user.rol === 'admin' || Number(user.puede_sobreturno) === 1;

module.exports = {
  auth,
  authCuenta,
  soloSuperadmin,
  membresia,
  requireRole,
  puedeOperarProfesional,
  assertProfesional,
  puedeSobreturno,
};
