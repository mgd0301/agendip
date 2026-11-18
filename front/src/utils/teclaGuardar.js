// F5 no recarga la página: lleva el foco al botón principal (Guardar, Asignar turno, etc.)
// de la ventana en la que se está trabajando. Luego Enter lo ejecuta.
// Ese botón se marca con data-f5-destino, y el estilo global le antepone «F5».
const PRIMARIO = 'button[data-variant="primary"]:not(:disabled)';

const ultimo = (cont) => {
  const botones = cont.querySelectorAll(PRIMARIO);
  return botones[botones.length - 1] || null;
};

export function botonDestino() {
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
  // Sin foco en ningún formulario: el botón principal de la pantalla.
  return document.querySelector('main ' + PRIMARIO) || document.querySelector(PRIMARIO);
}

let marcado = null;
function marcarDestino() {
  const boton = botonDestino();
  if (boton === marcado) return;
  marcado?.removeAttribute('data-f5-destino');
  boton?.setAttribute('data-f5-destino', '');
  marcado = boton;
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

  // La marca se actualiza al moverse entre controles y cuando cambia la pantalla.
  let pendiente = false;
  const programar = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      marcarDestino();
    });
  };
  document.addEventListener('focusin', programar);
  document.addEventListener('focusout', programar);
  new MutationObserver(programar).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled', 'role'],
  });
}
