// Utilidades de fecha/hora sobre strings locales (sin zona horaria).
const pad = (n) => String(n).padStart(2, '0');

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{2}:\d{2}(:\d{2})?$/;

const esFecha = (s) => typeof s === 'string' && RE_FECHA.test(s);
const esHora = (s) => typeof s === 'string' && RE_HORA.test(s);

const aMinutos = (hora) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

const aHora = (min) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const diaSemana = (fecha) => new Date(`${fecha}T00:00:00Z`).getUTCDay();

function rangoFechas(desde, hasta) {
  const out = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) out.push(f);
  return out;
}

function ahora() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const formatoFecha = (fecha) => {
  const [y, m, d] = fecha.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

module.exports = { pad, esFecha, esHora, aMinutos, aHora, sumarDias, diaSemana, rangoFechas, ahora, DIAS, formatoFecha };
