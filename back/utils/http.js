class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const badRequest = (msg, code) => new HttpError(400, msg, code);
const notFound = (msg = 'No encontrado') => new HttpError(404, msg);
const forbidden = (msg = 'No tiene permisos para esta acción') => new HttpError(403, msg);
const conflict = (msg, code) => new HttpError(409, msg, code);

// Devuelve solo los campos permitidos del body, convirtiendo '' en null.
function pick(body, fields) {
  const out = {};
  for (const f of fields) {
    if (body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

function required(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || String(body[f]).trim() === '') {
      throw badRequest(`El campo "${f}" es obligatorio`);
    }
  }
}

const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);

// MySQL 5.0 usa utf8 de 3 bytes: se eliminan emojis y caracteres fuera del BMP.
function sanitize(value) {
  if (typeof value === 'string') return value.replace(/[\u{10000}-\u{10FFFF}]/gu, '');
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) value[k] = sanitize(value[k]);
  }
  return value;
}

module.exports = { HttpError, badRequest, notFound, forbidden, conflict, pick, required, bool, sanitize };
