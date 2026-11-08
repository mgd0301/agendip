// Fechas como strings locales 'YYYY-MM-DD' para no depender de zonas horarias.
export const pad = (n) => String(n).padStart(2, '0');

export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Fecha y hora actual como 'YYYY-MM-DD HH:MM' (para comparar con fecha + hora de un turno).
export const ahora = () => {
  const d = new Date();
  return `${hoy()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const aDate = (f) => {
  const [y, m, d] = f.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};
const deDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const sumarDias = (f, n) => {
  const d = aDate(f);
  d.setDate(d.getDate() + n);
  return deDate(d);
};

export const sumarMeses = (f, n) => {
  const d = aDate(f);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return deDate(d);
};

export const diaSemana = (f) => aDate(f).getDay();

// Semana de lunes a domingo
export const inicioSemana = (f) => sumarDias(f, -((diaSemana(f) + 6) % 7));
export const inicioMes = (f) => `${f.slice(0, 7)}-01`;
export const finMes = (f) => sumarDias(sumarMeses(inicioMes(f), 1), -1);

export const rango = (desde, hasta) => {
  const out = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) out.push(f);
  return out;
};

export const aMin = (h) => {
  const [a, b] = h.slice(0, 5).split(':').map(Number);
  return a * 60 + b;
};
export const aHora = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

export const fechaCorta = (f) => {
  const [y, m, d] = f.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

export const fechaLarga = (f) => {
  const d = aDate(f.slice(0, 10));
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
};

export const fechaHora = (dt) => (dt ? `${fechaCorta(dt)} ${dt.slice(11, 16)}` : '');

export const edad = (nac) => {
  if (!nac) return null;
  const [y, m, d] = nac.split('-').map(Number);
  const h = new Date();
  let e = h.getFullYear() - y;
  if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) e--;
  return e;
};
