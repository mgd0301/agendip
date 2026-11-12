// Enter pasa al control siguiente (Shift+Enter, al anterior) en todas las pantallas.
// - En un área de texto, Enter sigue haciendo un salto de línea.
// - Si un control ya usa Enter (elegir un paciente de la lista, agregar un plan), se respeta.
// - En el último control: si el formulario tiene botón de envío, Enter lo envía como siempre;
//   si no, el foco pasa al botón principal (Guardar, Asignar turno…) y otro Enter lo ejecuta.
// En el celular, la tecla Enter del teclado muestra «Siguiente» o «Listo» según corresponda.
import { botonDestino } from './teclaGuardar';

const CONTROLES = 'input, select, textarea';
const NO_CAMPO = ['hidden', 'button', 'submit', 'reset', 'image', 'file'];

const esCampo = (el) =>
  el?.matches?.(CONTROLES) && !NO_CAMPO.includes(el.type) && !el.disabled && el.tabIndex >= 0 && el.getAttribute('aria-hidden') !== 'true';

const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

// Zona dentro de la que se navega: sub-formulario, formulario, ventana o la página.
const zonaDe = (el) => el.closest('[data-f5], form, [role="alertdialog"], [role="dialog"], main') || document.body;

function vecino(el, paso) {
  const campos = [...zonaDe(el).querySelectorAll(CONTROLES)].filter((c) => esCampo(c) && visible(c));
  const i = campos.indexOf(el);
  return i === -1 ? null : campos[i + paso] || null;
}

const enviaSolo = (el) => !!el.form && [...el.form.elements].some((x) => x.type === 'submit' && !x.disabled);

export function instalarTeclaEnter() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return;
    const el = e.target;
    if (!esCampo(el) || el.tagName === 'TEXTAREA') return;

    const destino = vecino(el, e.shiftKey ? -1 : 1);
    if (destino) {
      e.preventDefault();
      destino.focus();
      return;
    }
    if (e.shiftKey || enviaSolo(el)) return;
    e.preventDefault();
    const boton = botonDestino();
    if (boton) {
      boton.focus();
      boton.scrollIntoView({ block: 'nearest' });
    }
  });

  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!esCampo(el) || el.tagName === 'TEXTAREA' || el.hasAttribute('enterkeyhint')) return;
    el.enterKeyHint = vecino(el, 1) ? 'next' : enviaSolo(el) ? 'go' : 'done';
  });
}
