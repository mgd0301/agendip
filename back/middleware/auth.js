const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { HttpError, forbidden } = require('../utils/http');

async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Sesión no iniciada'));

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(new HttpError(401, 'Sesión vencida, vuelva a ingresar'));
  }

  const [user] = await query(
    `SELECT u.id, u.organizacion_id, u.nombre, u.email, u.rol, u.profesional_id, u.puede_sobreturno
       FROM usuarios u JOIN organizaciones o ON o.id = u.organizacion_id
      WHERE u.id = ? AND u.activo = 1 AND o.activo = 1`,
    [payload.id]
  );
  if (!user) return next(new HttpError(401, 'Usuario inactivo'));

  req.user = user;
  req.orgId = user.organizacion_id;
  next();
}

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

module.exports = { auth, requireRole, puedeOperarProfesional, assertProfesional, puedeSobreturno };
