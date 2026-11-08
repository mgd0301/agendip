// Reemplazo de window.confirm con el estilo de la app.
// Uso: if (!(await confirmar({ titulo, mensaje, peligro: true }))) return;
// El cuadro lo dibuja <ConfirmHost />, montado una sola vez en App.jsx.

let actual = null;
const oyentes = new Set();

const avisar = () => oyentes.forEach((fn) => fn());

export function suscribir(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

export const pedidoActual = () => actual;

/**
 * @param {object} op
 * @param {string} op.titulo
 * @param {string} [op.mensaje]
 * @param {string} [op.aceptar]   texto del botón principal (por defecto «Aceptar»)
 * @param {string} [op.cancelar]  texto del botón secundario (por defecto «Cancelar»)
 * @param {'peligro'|'aviso'|'info'} [op.tipo]
 * @returns {Promise<boolean>}
 */
export function confirmar(op) {
  // Si ya había uno abierto, se resuelve como cancelado.
  actual?.resolver(false);
  return new Promise((resolve) => {
    actual = {
      tipo: 'info',
      aceptar: 'Aceptar',
      cancelar: 'Cancelar',
      ...op,
      resolver: (v) => {
        actual = null;
        avisar();
        resolve(v);
      },
    };
    avisar();
  });
}
