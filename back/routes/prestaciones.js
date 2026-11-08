const { Router } = require('express');
const { query } = require('../db');
const { requireRole } = require('../middleware/auth');
const { pick, required, bool, notFound } = require('../utils/http');

const router = Router();
const CAMPOS = ['nombre', 'descripcion', 'duracion_min', 'precio', 'color'];

router.get('/', async (req, res) => {
  const soloActivas = req.query.todos !== '1';
  res.json(
    await query(
      `SELECT * FROM prestaciones WHERE organizacion_id = ? ${soloActivas ? 'AND activo = 1' : ''} ORDER BY nombre`,
      [req.orgId]
    )
  );
});

router.post('/', requireRole('admin'), async (req, res) => {
  required(req.body, ['nombre']);
  const r = await query('INSERT INTO prestaciones SET ?', [{ ...pick(req.body, CAMPOS), organizacion_id: req.orgId }]);
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const datos = pick(req.body, CAMPOS);
  if (req.body.activo !== undefined) datos.activo = bool(req.body.activo);
  const r = await query('UPDATE prestaciones SET ? WHERE id = ? AND organizacion_id = ?', [datos, req.params.id, req.orgId]);
  if (!r.affectedRows) throw notFound('Prestación no encontrada');
  res.json({ ok: true });
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const r = await query('UPDATE prestaciones SET activo = 0 WHERE id = ? AND organizacion_id = ?', [req.params.id, req.orgId]);
  if (!r.affectedRows) throw notFound('Prestación no encontrada');
  res.json({ ok: true });
});

module.exports = router;
