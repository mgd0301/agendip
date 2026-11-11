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

// Zona horaria de los consultorios. No depende de la del servidor (en la nube suele ser UTC).
const ZONA = process.env.APP_TZ || 'America/Argentina/Buenos_Aires';
const formato = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

// Fecha y hora actual en la zona de los consultorios: 'YYYY-MM-DD HH:MM:SS'.
function ahora(fecha = new Date()) {
  const p = Object.fromEntries(formato.formatToParts(fecha).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

const hoy = () => ahora().slice(0, 10);

// Diferencia con UTC de la zona de los consultorios, en formato MySQL ('-03:00').
function desfasajeUTC() {
  const local = new Date(`${ahora().replace(' ', 'T')}Z`);
  const min = Math.round((local - Date.now()) / 60000);
  const abs = Math.abs(min);
  return `${min < 0 ? '-' : '+'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const formatoFecha = (fecha) => {
  const [y, m, d] = fecha.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

module.exports = {
  pad, esFecha, esHora, aMinutos, aHora, sumarDias, diaSemana, rangoFechas, ahora, hoy, desfasajeUTC, ZONA, DIAS, formatoFecha,
};
