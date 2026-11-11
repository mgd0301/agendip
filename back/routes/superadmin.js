const { Router } = require('express');
const { query, transaction } = require('../db');
const { pick, required, bool, notFound, badRequest } = require('../utils/http');
const { crearDefaults } = require('../services/organizacion');
const { vincularCuenta } = require('../services/usuarios');
const { hoy, sumarDias } = require('../utils/fechas');

// Panel del dueño del sistema: todas las organizaciones (se protege en index.js).
const router = Router();
const TIPOS = ['consultorio', 'centro', 'profesional_independiente'];

router.get('/organizaciones', async (req, res) => {
  res.json(
    await query(
      `SELECT o.id, o.nombre, o.tipo, o.email, o.telefono, o.plan, o.max_profesionales, o.activo, o.creado_en,
              (SELECT COUNT(*) FROM profesionales p WHERE p.organizacion_id = o.id AND p.activo = 1) AS profesionales,
              (SELECT COUNT(*) FROM membresias m WHERE m.organizacion_id = o.id AND m.activo = 1) AS usuarios,
              (SELECT COUNT(*) FROM pacientes pa WHERE pa.organizacion_id = o.id AND pa.activo = 1) AS pacientes,
              (SELECT COUNT(*) FROM turnos t WHERE t.organizacion_id = o.id
                  AND t.inicio >= ?) AS turnos_mes,
              (SELECT MAX(u.ultimo_acceso) FROM membresias m JOIN usuarios u ON u.id = m.usuario_id
                WHERE m.organizacion_id = o.id) AS ultimo_acceso
         FROM organizaciones o ORDER BY o.nombre`,
      [sumarDias(hoy(), -30)]
    )
  );
});

router.get('/organizaciones/:id/usuarios', async (req, res) => {
  res.json(
    await query(
      `SELECT u.id, u.nombre, u.email, m.rol, m.activo, u.ultimo_acceso
         FROM membresias m JOIN usuarios u ON u.id = m.usuario_id
        WHERE m.organizacion_id = ? ORDER BY m.activo DESC, u.nombre`,
      [req.params.id]
    )
  );
});

function datosOrganizacion(body) {
  const datos = pick(body, ['nombre', 'tipo', 'email', 'telefono', 'plan', 'max_profesionales']);
  if (body.activo !== undefined) datos.activo = bool(body.activo);
  if (datos.tipo && !TIPOS.includes(datos.tipo)) throw badRequest('Tipo de organización inválido');
  if (datos.nombre === null) throw badRequest('El nombre es obligatorio');
  if (datos.plan === null) datos.plan = 'basico';
  if (datos.max_profesionales !== undefined && datos.max_profesionales !== null) {
    const n = Number(datos.max_profesionales);
    if (!Number.isInteger(n) || n < 1) throw badRequest('El máximo de profesionales debe ser un número mayor a cero');
    datos.max_profesionales = n;
  }
  return datos;
}

// Alta de una organización con su administrador (cuenta nueva o una existente).
router.post('/organizaciones', async (req, res) => {
  required(req.body, ['nombre']);
  required(req.body.admin || {}, ['nombre', 'email']);
  const datos = datosOrganizacion(req.body);
  const r = await transaction(async (conn) => {
    const [org] = await conn.query('INSERT INTO organizaciones SET ?', [datos]);
    await crearDefaults(conn, org.insertId);
    const admin = await vincularCuenta(conn, org.insertId, req.body.admin, { rol: 'admin', puede_sobreturno: 1 });
    return { id: org.insertId, admin };
  });
  res.status(201).json(r);
});

router.put('/organizaciones/:id', async (req, res) => {
  const [o] = await query('SELECT id FROM organizaciones WHERE id = ?', [req.params.id]);
  if (!o) throw notFound('Organización no encontrada');
  const datos = datosOrganizacion(req.body);
  if (Object.keys(datos).length) await query('UPDATE organizaciones SET ? WHERE id = ?', [datos, o.id]);
  res.json({ ok: true });
});

module.exports = router;
