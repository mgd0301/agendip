// F5 no recarga la página: lleva el foco al botón principal (Guardar, Asignar turno, etc.)
// de la ventana en la que se está trabajando. Luego Enter lo ejecuta.
const PRIMARIO = 'button[data-variant="primary"]:not(:disabled)';

const ultimo = (cont) => {
  const botones = cont.querySelectorAll(PRIMARIO);
  return botones[botones.length - 1] || null;
};

function botonDestino() {
  const activo = document.activeElement;

  // Un cuadro de confirmación abierto tiene prioridad.
  const confirmacion = document.querySelector('[role="alertdialog"]');
  if (confirmacion) return ultimo(confirmacion);

  // Sub-formulario con su propio botón (ej: alta rápida de paciente dentro del turno).
  const zona = activo?.closest?.('[data-f5]');
  if (zona && ultimo(zona)) return ultimo(zona);

  // Ventana abierta: su botón principal (el del pie es el último).
  const dialogos = document.querySelectorAll('[role="dialog"]');
  if (dialogos.length) return ultimo(dialogos[dialogos.length - 1]);

  // Sin ventana: el botón principal de la sección donde está el cursor.
  for (let el = activo; el && el !== document.body; el = el.parentElement) {
    const b = el.querySelector(PRIMARIO);
    if (b) return b;
  }
  return null;
}

export function instalarTeclaGuardar() {
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'F5') return;
      e.preventDefault();
      const boton = botonDestino();
      if (boton) {
        boton.focus();
        boton.scrollIntoView({ block: 'nearest' });
      }
    },
    true
  );
}
