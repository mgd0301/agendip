const { Router } = require('express');
const { query } = require('../db');
const { badRequest } = require('../utils/http');
const { esFecha, rangoFechas, aMinutos } = require('../utils/fechas');
const { cargarContexto, franjasDelDia } = require('../services/agenda');

const router = Router();

// Resumen por profesional: cantidad por estado y % de ocupación del período.
router.get('/resumen', async (req, res) => {
  const { desde, hasta } = req.query;
  if (!esFecha(desde) || !esFecha(hasta) || desde > hasta) throw badRequest('Rango de fechas inválido');
  const dias = rangoFechas(desde, hasta);
  if (dias.length > 370) throw badRequest('El rango máximo es de un año');

  let profesionales = await query(
    'SELECT id, nombre, apellido, color FROM profesionales WHERE organizacion_id = ? AND activo = 1 ORDER BY apellido',
    [req.orgId]
  );
  if (req.user.rol === 'profesional') profesionales = profesionales.filter((p) => p.id === req.user.profesional_id);
  const ids = profesionales.map((p) => p.id);
  if (!ids.length) return res.json([]);

  const conteos = await query(
    `SELECT profesional_id, estado, COUNT(*) AS cantidad, SUM(duracion_min) AS minutos
       FROM turnos WHERE organizacion_id = ? AND profesional_id IN (?) AND inicio >= ? AND inicio <= ?
      GROUP BY profesional_id, estado`,
    [req.orgId, ids, `${desde} 00:00:00`, `${hasta} 23:59:59`]
  );
  const ctx = await cargarContexto(req.orgId, ids, desde, hasta);

  res.json(
    profesionales.map((p) => {
      const propios = conteos.filter((c) => c.profesional_id === p.id);
      const por_estado = Object.fromEntries(propios.map((c) => [c.estado, Number(c.cantidad)]));
      const ocupados = propios.filter((c) => c.estado !== 'cancelado').reduce((s, c) => s + Number(c.minutos), 0);
      const disponibles = dias.reduce(
        (s, f) => s + franjasDelDia(ctx, p.id, f).franjas.reduce((a, fr) => a + aMinutos(fr.hasta) - aMinutos(fr.desde), 0),
        0
      );
      return {
        ...p,
        por_estado,
        total: propios.reduce((s, c) => s + Number(c.cantidad), 0),
        minutos_disponibles: disponibles,
        minutos_ocupados: ocupados,
        ocupacion: disponibles ? Math.round((ocupados / disponibles) * 1000) / 10 : null,
      };
    })
  );
});

module.exports = router;
