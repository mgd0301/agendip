require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const { auth, requireRole } = require('./middleware/auth');
const { sanitize } = require('./utils/http');

if (!process.env.JWT_SECRET) {
  console.error('Falta definir JWT_SECRET en el archivo .env');
  process.exit(1);
}

const app = express();
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

app.use('/api/auth', require('./routes/auth'));
app.use('/api/profesionales', auth, require('./routes/profesionales'));
app.use('/api/prestaciones', auth, require('./routes/prestaciones'));
app.use('/api/pacientes', auth, require('./routes/pacientes'));
app.use('/api/excepciones', auth, require('./routes/excepciones'));
app.use('/api/turnos', auth, require('./routes/turnos'));
app.use('/api/usuarios', auth, requireRole('admin'), require('./routes/usuarios'));
app.use('/api/config', auth, require('./routes/config'));
app.use('/api/reportes', auth, require('./routes/reportes'));

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
app.listen(PORT, () => console.log(`Agendia API escuchando en http://localhost:${PORT}`));
