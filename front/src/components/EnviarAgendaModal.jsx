import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FaWhatsapp } from 'react-icons/fa';
import { FiCopy } from 'react-icons/fi';
import api, { errorMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { useDatos } from '../context/DatosContext';
import { Button, Field, Grid, Input, Modal, Muted, Select, Spinner, Textarea } from './ui';

// Arma el listado de turnos de un profesional y lo abre en WhatsApp (o lo copia).
export default function EnviarAgendaModal({ profesionalId, desde: desdeIni, hasta: hastaIni, onClose }) {
  const { usuario } = useAuth();
  const { profesionales } = useDatos();
  const esProf = usuario.rol === 'profesional';
  const [form, setForm] = useState({
    profesional_id: esProf ? usuario.profesional_id : profesionalId || profesionales[0]?.id || '',
    desde: desdeIni,
    hasta: hastaIni,
  });
  const [resumen, setResumen] = useState(null);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!form.profesional_id || !form.desde || !form.hasta) return;
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      api
        .get('/turnos/resumen-agenda', { params: form, signal: ctrl.signal })
        .then((r) => {
          setResumen(r.data);
          setTexto(r.data.texto);
          setError(null);
        })
        .catch((err) => {
          if (!ctrl.signal.aborted) setError(errorMsg(err));
        });
    }, 250);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [form]);

  const set = (k) => (e) => {
    const v = e.target.value;
    const nuevo = { ...form, [k]: v };
    if (k === 'desde' && v > form.hasta) nuevo.hasta = v;
    if (k === 'hasta' && v < form.desde) nuevo.desde = v;
    setForm(nuevo);
  };

  const enviar = () => {
    window.open(`https://wa.me/${resumen.telefono || ''}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Agenda copiada');
    } catch {
      toast.error('No se pudo copiar. Seleccioná el texto y copialo a mano.');
    }
  };

  const prof = profesionales.find((p) => p.id === Number(form.profesional_id));

  return (
    <Modal
      title="Enviar agenda por WhatsApp"
      onClose={onClose}
      footer={
        <>
          <Button $variant="secondary" onClick={copiar} disabled={!resumen} style={{ marginRight: 'auto' }}>
            <FiCopy /> Copiar
          </Button>
          <Button $variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
          <Button $variant="whatsapp" onClick={enviar} disabled={!resumen}>
            <FaWhatsapp /> Enviar
          </Button>
        </>
      }
    >
      <Grid $cols={3}>
        {!esProf && (
          <Field label="Profesional" style={{ gridColumn: '1 / -1' }}>
            <Select value={form.profesional_id} onChange={set('profesional_id')}>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.apellido}, {p.nombre}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Desde">
          <Input type="date" value={form.desde} onChange={set('desde')} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={form.hasta} onChange={set('hasta')} />
        </Field>
      </Grid>

      <Field label="Mensaje (podés editarlo antes de enviar)" style={{ marginTop: 12 }}>
        {error ? (
          <Muted style={{ color: '#dc2626' }}>{error}</Muted>
        ) : !resumen ? (
          <Spinner />
        ) : (
          <Textarea rows={12} value={texto} onChange={(e) => setTexto(e.target.value)} style={{ fontFamily: 'inherit' }} />
        )}
      </Field>

      {resumen && (
        <Muted $size="13px" style={{ display: 'block', marginTop: 8 }}>
          {resumen.telefono
            ? `Se envía al ${prof?.telefono || resumen.telefono}${esProf ? '' : `, el teléfono de ${prof?.nombre || 'el profesional'}`}.`
            : 'El profesional no tiene teléfono cargado: WhatsApp se abrirá para que elijas el contacto.'}
        </Muted>
      )}
    </Modal>
  );
}
