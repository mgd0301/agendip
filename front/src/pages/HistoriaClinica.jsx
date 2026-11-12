import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiEdit2, FiMessageSquare, FiPlus, FiPrinter } from 'react-icons/fi';
import api, { errorMsg } from '../api';
import { useAuth } from '../context/AuthContext';
import { Badge, Button, Card, Empty, Field, Grid, Input, Muted, Page, Row, Spinner, Textarea } from '../components/ui';
import { theme as t } from '../styles/GlobalStyle';
import { ahora, edad, fechaCorta, fechaHora } from '../utils/fechas';

const CAMPOS = [
  ['motivo', 'Motivo de consulta'],
  ['examen', 'Examen / evaluación'],
  ['diagnostico', 'Diagnóstico'],
  ['indicaciones', 'Indicaciones / tratamiento'],
];

const ANTECEDENTES = [
  ['antecedentes', 'Antecedentes personales y familiares'],
  ['alergias', 'Alergias'],
  ['medicacion', 'Medicación habitual'],
];

const SEXO = { F: 'Femenino', M: 'Masculino', X: 'X' };

const Encabezado = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
  h1 { font-size: 22px; margin-right: auto; }
  @media print { h1 { font-size: 18px; } }
`;

const Seccion = styled(Card)`
  margin-bottom: 14px;
  h3 { font-size: 15px; margin-bottom: 10px; }
  @media print { break-inside: avoid; border-color: #cbd5e1; }
`;

const Datos = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px 16px;
  margin: 0;
  dt { font-size: 12px; color: ${t.muted}; }
  dd { margin: 0; font-weight: 500; }
`;

// Texto cargado por el profesional: se respetan los saltos de línea.
const Bloque = styled.div`
  margin-top: 8px;
  h4 { font-size: 12px; color: ${t.muted}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
  p { margin: 2px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
`;

const Evolucion = styled(Card)`
  margin-bottom: 12px;
  border-left: 4px solid ${t.primary};
  @media print { break-inside: avoid; border-color: #cbd5e1; }
`;

const Cabeza = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  strong { font-size: 15px; }
`;

const Aclaracion = styled.div`
  margin-top: 10px;
  padding: 8px 10px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  p { margin: 2px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
`;

const firma = (x) => `${x.prof_apellido?.trim()}, ${x.prof_nombre}`;

function FormEvolucion({ inicial, onCancelar, onGuardar }) {
  const [form, setForm] = useState(inicial);
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar({ ...form, fecha: form.fecha.replace('T', ' ') });
    } catch (err) {
      toast.error(errorMsg(err));
      setGuardando(false);
    }
  };

  return (
    <Seccion as="form" onSubmit={guardar} data-f5 className="no-print">
      <h3>{inicial.id ? 'Corregir evolución' : 'Nueva evolución'}</h3>
      <Grid>
        <Field label="Fecha y hora de la consulta">
          <Input type="datetime-local" value={form.fecha} onChange={set('fecha')} required disabled={!!inicial.id} />
        </Field>
      </Grid>
      {CAMPOS.map(([k, l], i) => (
        <Field key={k} label={l} style={{ marginTop: 10 }}>
          <Textarea value={form[k] || ''} onChange={set(k)} rows={k === 'examen' || k === 'indicaciones' ? 4 : 2} autoFocus={i === 0} />
        </Field>
      ))}
      <Row $justify="flex-end" style={{ marginTop: 12 }}>
        <Button $variant="secondary" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar evolución'}
        </Button>
      </Row>
    </Seccion>
  );
}

function Antecedentes({ datos, pacienteId, onGuardado }) {
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.put(`/historias/${pacienteId}/antecedentes`, form);
      toast.success('Antecedentes guardados');
      setForm(null);
      onGuardado();
    } catch (err) {
      toast.error(errorMsg(err));
    } finally {
      setGuardando(false);
    }
  };

  if (form) {
    return (
      <Seccion as="form" onSubmit={guardar} data-f5>
        <h3>Antecedentes</h3>
        {ANTECEDENTES.map(([k, l], i) => (
          <Field key={k} label={l} style={{ marginTop: i ? 10 : 0 }}>
            <Textarea value={form[k] || ''} onChange={set(k)} rows={k === 'antecedentes' ? 4 : 2} autoFocus={i === 0} />
          </Field>
        ))}
        <Muted as="p" $size="12px" style={{ marginTop: 8 }}>
          La versión anterior queda guardada en el registro.
        </Muted>
        <Row $justify="flex-end" style={{ marginTop: 12 }}>
          <Button $variant="secondary" onClick={() => setForm(null)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            Guardar
          </Button>
        </Row>
      </Seccion>
    );
  }

  const vacios = !datos || ANTECEDENTES.every(([k]) => !datos[k]);
  return (
    <Seccion>
      <Row $justify="space-between">
        <h3 style={{ margin: 0 }}>Antecedentes</h3>
        <Button
          $small
          $variant="secondary"
          className="no-print"
          onClick={() => setForm(Object.fromEntries(ANTECEDENTES.map(([k]) => [k, datos?.[k] || ''])))}
        >
          <FiEdit2 /> {vacios ? 'Cargar' : 'Actualizar'}
        </Button>
      </Row>
      {vacios ? (
        <Muted as="p">Sin antecedentes cargados.</Muted>
      ) : (
        <>
          {ANTECEDENTES.map(([k, l]) => (
            <Bloque key={k}>
              <h4>{l}</h4>
              <p>{datos[k] || '—'}</p>
            </Bloque>
          ))}
          <Muted as="p" $size="12px" style={{ marginTop: 10 }}>
            Actualizado el {fechaHora(datos.creado_en)} por {firma(datos)}
          </Muted>
        </>
      )}
    </Seccion>
  );
}

function TarjetaEvolucion({ e, onCorregir, onAclarado }) {
  const [aclarando, setAclarando] = useState(null);

  const aclarar = async (ev) => {
    ev.preventDefault();
    try {
      await api.post(`/historias/evoluciones/${e.id}/aclaraciones`, { texto: aclarando });
      setAclarando(null);
      onAclarado();
    } catch (err) {
      toast.error(errorMsg(err));
    }
  };

  return (
    <Evolucion>
      <Cabeza>
        <strong>{fechaHora(e.fecha)}</strong>
        <Muted>
          {firma(e)}
          {e.prof_especialidad && ` · ${e.prof_especialidad}`}
          {e.prof_matricula && ` · Mat. ${e.prof_matricula}`}
        </Muted>
        {e.editado_en && (
          <Badge $color="#64748b" title={`Corregida el ${fechaHora(e.editado_en)}`}>
            Corregida
          </Badge>
        )}
      </Cabeza>
      {CAMPOS.filter(([k]) => e[k]).map(([k, l]) => (
        <Bloque key={k}>
          <h4>{l}</h4>
          <p>{e[k]}</p>
        </Bloque>
      ))}
      {e.aclaraciones.map((a) => (
        <Aclaracion key={a.id}>
          <Muted $size="12px">
            Aclaración · {fechaHora(a.creado_en)} · {firma(a)}
          </Muted>
          <p>{a.texto}</p>
        </Aclaracion>
      ))}
      {aclarando !== null ? (
        <form onSubmit={aclarar} data-f5 style={{ marginTop: 10 }}>
          <Field label="Aclaración">
            <Textarea value={aclarando} onChange={(ev) => setAclarando(ev.target.value)} rows={2} autoFocus required />
          </Field>
          <Row $justify="flex-end" style={{ marginTop: 8 }}>
            <Button $small $variant="ghost" onClick={() => setAclarando(null)}>
              Cancelar
            </Button>
            <Button $small type="submit">
              Agregar aclaración
            </Button>
          </Row>
        </form>
      ) : (
        <Row $justify="flex-end" style={{ marginTop: 10 }} className="no-print">
          {e.editable && (
            <Button $small $variant="secondary" onClick={onCorregir} title="Se puede corregir solo el mismo día en que se cargó">
              <FiEdit2 /> Corregir
            </Button>
          )}
          <Button $small $variant="ghost" onClick={() => setAclarando('')}>
            <FiMessageSquare /> Aclarar
          </Button>
        </Row>
      )}
    </Evolucion>
  );
}

export default function HistoriaClinica() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [hc, setHc] = useState(null);
  const [form, setForm] = useState(null); // evolución en edición o nueva

  const cargar = useCallback(
    () =>
      api
        .get(`/historias/${id}`)
        .then((r) => setHc(r.data))
        .catch((err) => toast.error(errorMsg(err))),
    [id]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Desde un turno: se abre directamente la evolución de esa consulta.
  const turnoId = params.get('turno');
  useEffect(() => {
    if (!turnoId) return;
    api
      .get(`/turnos/${turnoId}`)
      .then((r) => setForm({ turno_id: Number(turnoId), fecha: r.data.inicio.slice(0, 16).replace(' ', 'T') }))
      .catch(() => {});
    setParams({}, { replace: true });
  }, [turnoId, setParams]);

  const nueva = () => setForm({ fecha: ahora().slice(0, 16).replace(' ', 'T') });

  const guardar = async (datos) => {
    if (datos.id) await api.put(`/historias/evoluciones/${datos.id}`, datos);
    else await api.post(`/historias/${id}/evoluciones`, datos);
    toast.success('Evolución guardada');
    setForm(null);
    cargar();
  };

  if (!hc) return <Spinner />;
  const p = hc.paciente;

  return (
    <Page $max="900px">
      <Encabezado>
        <Button $variant="ghost" className="no-print" onClick={() => navigate(-1)} aria-label="Volver">
          <FiArrowLeft size={18} />
        </Button>
        <h1>
          Historia clínica
          <Muted as="div" $size="15px" style={{ fontWeight: 500 }}>
            {p.apellido}, {p.nombre}
          </Muted>
        </h1>
        <Button $variant="secondary" className="no-print" onClick={() => window.print()}>
          <FiPrinter /> Imprimir
        </Button>
        {!form && (
          <Button className="no-print" onClick={nueva}>
            <FiPlus /> Nueva evolución
          </Button>
        )}
      </Encabezado>

      <Seccion>
        <Datos>
          <div>
            <dt>DNI</dt>
            <dd>{p.dni || '—'}</dd>
          </div>
          <div>
            <dt>Nacimiento</dt>
            <dd>{p.fecha_nacimiento ? `${fechaCorta(p.fecha_nacimiento)} (${edad(p.fecha_nacimiento)} años)` : '—'}</dd>
          </div>
          <div>
            <dt>Sexo</dt>
            <dd>{SEXO[p.sexo] || '—'}</dd>
          </div>
          <div>
            <dt>Obra social</dt>
            <dd>
              {p.obra_social || 'Particular'}
              {p.plan && ` · ${p.plan}`}
              {p.nro_afiliado && ` · Nº ${p.nro_afiliado}`}
            </dd>
          </div>
        </Datos>
      </Seccion>

      {!hc.compartida && (
        <Muted as="p" $size="13px" style={{ margin: '-4px 0 12px' }} className="no-print">
          En este consultorio cada profesional ve solo lo que registró.
        </Muted>
      )}

      <Antecedentes datos={hc.antecedentes} pacienteId={id} onGuardado={cargar} />

      {form && <FormEvolucion key={form.id || 'nueva'} inicial={form} onCancelar={() => setForm(null)} onGuardar={guardar} />}

      <h3 style={{ fontSize: 15, margin: '18px 0 10px' }}>Evoluciones ({hc.evoluciones.length})</h3>
      {hc.evoluciones.length === 0 ? (
        <Empty>Todavía no hay evoluciones registradas.</Empty>
      ) : (
        hc.evoluciones.map((e) => (
          <TarjetaEvolucion
            key={e.id}
            e={e}
            onAclarado={cargar}
            onCorregir={() => {
              setForm({ ...e, fecha: e.fecha.slice(0, 16).replace(' ', 'T') });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ))
      )}

      <Muted as="p" $size="12px" className="solo-print" style={{ marginTop: 16 }}>
        {usuario.organizacion?.nombre} · Impreso el {fechaHora(ahora())} por {usuario.nombre}
      </Muted>
    </Page>
  );
}
