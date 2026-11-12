require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { pool } = require('./db');
const { auth, authCuenta, soloSuperadmin, requireRole } = require('./middleware/auth');
const { sanitize } = require('./utils/http');

const produccion = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET) {
  console.error('Falta definir JWT_SECRET en el archivo .env');
  process.exit(1);
}
if (produccion && (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('cambiar'))) {
  console.error('En producción JWT_SECRET debe ser una clave aleatoria de al menos 32 caracteres');
  process.exit(1);
}
if (produccion && (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*')) {
  console.error('En producción CORS_ORIGIN debe indicar el dominio del frontend (ej. https://agendip.pages.dev)');
  process.exit(1);
}

const app = express();
// Railway (y cualquier hosting con proxy) entrega la IP real del cliente en X-Forwarded-For.
if (process.env.TRUST_PROXY !== '0') app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN === '*' || !process.env.CORS_ORIGIN ? true : process.env.CORS_ORIGIN.split(',') }));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  req.body = sanitize(req.body || {});
  next();
});

app.get('/api/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

// Límite de intentos contra la adivinación de contraseñas: por IP y, en el login, también por email.
const limite = (opciones) =>
  rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: 'Demasiados intentos. Espere unos minutos y vuelva a probar.' }),
    ...opciones,
  });
const minutos = (n) => n * 60 * 1000;
app.use('/api/auth/login', limite({ windowMs: minutos(15), limit: 20 }));
app.use(
  '/api/auth/login',
  limite({
    windowMs: minutos(15),
    limit: 10,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `email:${String(req.body?.email || '').trim().toLowerCase()}`,
  })
);
app.use(['/api/auth/recuperar', '/api/auth/restablecer'], limite({ windowMs: minutos(60), limit: 10 }));
app.use('/api/auth/registro', limite({ windowMs: minutos(60), limit: 5 }));
app.use(['/api/auth/password', '/api/auth/perfil'], limite({ windowMs: minutos(15), limit: 10 }));
app.use('/api', limite({ windowMs: minutos(1), limit: 300 }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/profesionales', auth, require('./routes/profesionales'));
app.use('/api/prestaciones', auth, require('./routes/prestaciones'));
app.use('/api/obras-sociales', auth, require('./routes/obrasSociales'));
app.use('/api/pacientes', auth, require('./routes/pacientes'));
app.use('/api/historias', auth, require('./routes/historias'));
app.use('/api/excepciones', auth, require('./routes/excepciones'));
app.use('/api/turnos', auth, require('./routes/turnos'));
app.use('/api/usuarios', auth, requireRole('admin'), require('./routes/usuarios'));
app.use('/api/config', auth, require('./routes/config'));
app.use('/api/reportes', auth, require('./routes/reportes'));
app.use('/api/superadmin', authCuenta, soloSuperadmin, require('./routes/superadmin'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Express 5 propaga automáticamente los errores de handlers async.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El registro ya existe' });
  if (err.code === 'ER_ROW_IS_REFERENCED' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ error: 'No se puede eliminar porque tiene datos asociados' });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (['ER_ACCESS_DENIED_ERROR', 'ECONNREFUSED', 'ER_BAD_DB_ERROR', 'PROTOCOL_CONNECTION_LOST'].includes(err.code)) {
    console.error(`Base de datos no disponible: ${err.code} - ${err.message}`);
    return res.status(503).json({ error: 'No se pudo conectar a la base de datos. Revise la configuración del servidor (.env).' });
  }
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`Agendip API escuchando en http://localhost:${PORT}`));
