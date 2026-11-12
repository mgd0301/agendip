import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { FiSearch, FiUserPlus, FiX } from 'react-icons/fi';
import api, { errorMsg } from '../api';
import { useDatos } from '../context/DatosContext';
import { Button, Field, Grid, Input, Muted, Row, Select } from './ui';
import { theme as t } from '../styles/GlobalStyle';

const Wrap = styled.div`
  position: relative;
`;

const Lista = styled.ul`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  list-style: none;
  margin: 0;
  padding: 4px;
  background: #fff;
  border: 1px solid ${t.border};
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12);
  max-height: 260px;
  overflow-y: auto;
  li {
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
  }
  li:hover, li[aria-selected='true'] { background: ${t.primarySoft}; }
  small { color: ${t.muted}; margin-left: 6px; }
`;

const Seleccionado = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid ${t.border};
  border-radius: 8px;
  background: #f8fafc;
  min-height: 38px;
  strong { display: block; }
`;

const Alta = styled.div`
  position: relative;
  z-index: 1;
  background: #fff;
  border: 2px solid ${t.primary};
  border-radius: 12px;
  box-shadow: 0 0 0 4px ${t.primarySoft}, 0 12px 28px rgba(15, 23, 42, 0.18);
  overflow: hidden;
`;

const AltaHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: ${t.primary};
  color: #fff;
  strong { display: flex; align-items: center; gap: 8px; font-size: 15px; }
  button { color: #fff; }
  button:hover { background: rgba(255, 255, 255, 0.15); }
`;

const VACIO = { nombre: '', apellido: '', telefono: '', dni: '', email: '', obra_social_id: '', plan_id: '', nro_afiliado: '' };

// Búsqueda de paciente existente con alta rápida en el mismo lugar.
export default function PacienteSelector({ value, onChange, disabled }) {
  const { obrasSociales } = useDatos();
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const [nuevo, setNuevo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) return;
    timer.current = setTimeout(() => {
      api
        .get('/pacientes', { params: { q, limit: 8 } })
        .then((r) => {
          setResultados(r.data.items);
          setActivo(0);
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  const elegir = (p) => {
    onChange(p);
    setQ('');
    setResultados([]);
    setAbierto(false);
  };

  const onKey = (e) => {
    if (!resultados.length) return;
    if (e.key === 'ArrowDown') setActivo((a) => Math.min(a + 1, resultados.length - 1));
    else if (e.key === 'ArrowUp') setActivo((a) => Math.max(a - 1, 0));
    else if (e.key === 'Enter') {
      e.preventDefault();
      elegir(resultados[activo]);
    } else return;
    e.preventDefault();
  };

  const crear = async () => {
    if (!nuevo.nombre.trim() || !nuevo.apellido.trim()) return toast.error('Nombre y apellido son obligatorios');
    setGuardando(true);
    try {
      const { data } = await api.post('/pacientes', nuevo);
      toast.success('Paciente creado');
      setNuevo(null);
      elegir(data);
    } catch (err) {
      toast.error(errorMsg(err));
    } finally {
      setGuardando(false);
    }
  };

  if (value) {
    return (
      <Seleccionado>
        <div>
          <strong>
            {value.apellido}, {value.nombre}
          </strong>
          <Muted $size="12px">
            {[value.dni && `DNI ${value.dni}`, value.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </Muted>
        </div>
        {!disabled && (
          <Button $small $variant="ghost" onClick={() => onChange(null)}>
            Cambiar
          </Button>
        )}
      </Seleccionado>
    );
  }

  if (nuevo) {
    const set = (k) => (e) => setNuevo({ ...nuevo, [k]: e.target.value });
    const planes = obrasSociales.find((o) => o.id === Number(nuevo.obra_social_id))?.planes || [];
    return (
      <Alta data-f5>
        <AltaHeader>
          <strong>
            <FiUserPlus /> Nuevo paciente
          </strong>
          <Button $small $variant="ghost" onClick={() => setNuevo(null)}>
            <FiX /> Cancelar
          </Button>
        </AltaHeader>
        <Grid style={{ padding: 12 }}>
          <Field label="Nombre *">
            <Input value={nuevo.nombre} onChange={set('nombre')} autoFocus />
          </Field>
          <Field label="Apellido *">
            <Input value={nuevo.apellido} onChange={set('apellido')} />
          </Field>
          <Field label="Teléfono (WhatsApp)">
            <Input value={nuevo.telefono} onChange={set('telefono')} inputMode="tel" />
          </Field>
          <Field label="DNI">
            <Input value={nuevo.dni} onChange={set('dni')} inputMode="numeric" />
          </Field>
          <Field label="Email" style={{ gridColumn: '1 / -1' }}>
            <Input type="email" value={nuevo.email} onChange={set('email')} />
          </Field>
          <Field label="Obra social / prepaga">
            <Select value={nuevo.obra_social_id} onChange={(e) => setNuevo({ ...nuevo, obra_social_id: e.target.value, plan_id: '' })}>
              <option value="">Particular (sin obra social)</option>
              {obrasSociales.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plan">
            <Select value={nuevo.plan_id} onChange={set('plan_id')} disabled={!planes.length}>
              <option value="">{!nuevo.obra_social_id ? '—' : planes.length ? 'Sin especificar' : 'Sin planes cargados'}</option>
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </Field>
          {nuevo.obra_social_id && (
            <Field label="Nº de afiliado">
              <Input value={nuevo.nro_afiliado} onChange={set('nro_afiliado')} />
            </Field>
          )}
        </Grid>
        <Row $justify="flex-end" style={{ padding: '0 12px 12px' }}>
          <Button $small onClick={crear} disabled={guardando}>
            Guardar y seleccionar
          </Button>
        </Row>
      </Alta>
    );
  }

  return (
    <Wrap>
      <Row>
        <div style={{ position: 'relative', flex: 1 }}>
          <FiSearch style={{ position: 'absolute', left: 10, top: 12, color: t.muted }} />
          <Input
            style={{ paddingLeft: 32 }}
            placeholder="Buscar por nombre, DNI o teléfono…"
            value={q}
            disabled={disabled}
            onChange={(e) => {
              setQ(e.target.value);
              if (!e.target.value.trim()) setResultados([]);
              setAbierto(true);
            }}
            onFocus={() => setAbierto(true)}
            onBlur={() => setTimeout(() => setAbierto(false), 150)}
            onKeyDown={onKey}
          />
        </div>
        <Button $variant="secondary" onClick={() => setNuevo({ ...VACIO, apellido: q.trim() })} title="Alta rápida de paciente">
          <FiUserPlus /> Nuevo
        </Button>
      </Row>
      {abierto && q.trim() && (
        <Lista role="listbox">
          {resultados.length === 0 && <li onMouseDown={() => setNuevo({ ...VACIO, apellido: q.trim() })}>Sin resultados · crear paciente nuevo</li>}
          {resultados.map((p, i) => (
            <li key={p.id} aria-selected={i === activo} onMouseDown={() => elegir(p)}>
              {p.apellido}, {p.nombre}
              <small>{[p.dni && `DNI ${p.dni}`, p.telefono].filter(Boolean).join(' · ')}</small>
            </li>
          ))}
        </Lista>
      )}
    </Wrap>
  );
}
