// Estado persistente de la app (localStorage). Genérico: no sabe nada de la Divina Comedia.
//
// Modelo:
//   metas:    [{ id, pack, titulo, inicio: 'YYYY-MM-DD', recordatorio: 'HH:MM', activa }]
//   progreso: { [metaId]: { hechos: { [n]: 'YYYY-MM-DD' } } }   // ítem n -> fecha en que se hizo
//   ajustes:  { tema, pasoLectura (0-20, como la barrita de Laudes), github: { token, repo }, notificaciones: { activas, hora } }

import { hoyISO } from './fechas.js';

const CLAVE = 'cadadia.v1';
const oyentes = new Set();

const porDefecto = () => ({
  version: 1,
  metas: [],
  progreso: {},
  ajustes: {
    tema: 'auto',
    pasoLectura: 4,
    github: { token: '', repo: 'lucasague/rutina-datos' },
    notificaciones: { activas: false, hora: '07:00' },
    dispositivo: '',
  },
});

let estado = cargar();

function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return porDefecto();
    const base = porDefecto();
    const guardado = JSON.parse(crudo);
    return {
      ...base,
      ...guardado,
      ajustes: { ...base.ajustes, ...(guardado.ajustes || {}),
        github: { ...base.ajustes.github, ...((guardado.ajustes || {}).github || {}) },
        notificaciones: { ...base.ajustes.notificaciones, ...((guardado.ajustes || {}).notificaciones || {}) } },
    };
  } catch (e) {
    console.warn('Estado corrupto, se reinicia', e);
    return porDefecto();
  }
}

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { console.warn('No se pudo guardar', e); }
  oyentes.forEach((f) => f(estado));
}

export const obtener = () => estado;

// Tamaño de lectura igual que en Laudes: paso 0-20 (4 por defecto) → escala 0.9-1.28.
export const PASOS_LECTURA = 20;
export function escalaLectura(paso = estado.ajustes.pasoLectura) {
  const p = Math.min(PASOS_LECTURA, Math.max(0, Math.round(Number(paso))));
  return +(0.9 + (Number.isFinite(p) ? p : 4) / PASOS_LECTURA * (1.28 - 0.9)).toFixed(4);
}
export const suscribir = (f) => { oyentes.add(f); return () => oyentes.delete(f); };

// ---------- metas ----------
export function metaActiva() {
  return estado.metas.find((m) => m.activa) || estado.metas[0] || null;
}
export function crearMeta({ pack, titulo, recordatorio = '07:00' }) {
  const id = `${pack}-${Date.now().toString(36)}`;
  estado.metas.forEach((m) => (m.activa = false));
  estado.metas.push({ id, pack, titulo, inicio: hoyISO(), recordatorio, activa: true });
  estado.progreso[id] = { hechos: {} };
  guardar();
  return id;
}
export function activarMeta(id) {
  estado.metas.forEach((m) => (m.activa = m.id === id));
  guardar();
}
export function borrarMeta(id) {
  estado.metas = estado.metas.filter((m) => m.id !== id);
  delete estado.progreso[id];
  if (estado.metas.length && !estado.metas.some((m) => m.activa)) estado.metas[0].activa = true;
  guardar();
}

// ---------- progreso ----------
export function hechos(metaId) {
  return (estado.progreso[metaId] || { hechos: {} }).hechos;
}
export function estaHecho(metaId, n) {
  return Boolean(hechos(metaId)[n]);
}
export function marcarHecho(metaId, n, fecha = hoyISO()) {
  if (!estado.progreso[metaId]) estado.progreso[metaId] = { hechos: {} };
  estado.progreso[metaId].hechos[n] = fecha;
  guardar();
}
export function desmarcar(metaId, n) {
  if (!estado.progreso[metaId]) return;
  delete estado.progreso[metaId].hechos[n];
  guardar();
}
/** Día en que la meta empezó de verdad: el del primer ítem hecho (no el de crearla). */
export function inicioMeta(meta) {
  const fechas = Object.values(hechos(meta.id)).sort();
  return fechas[0] || meta.inicio;
}
/** Fechas (YYYY-MM-DD) en las que se hizo al menos una cosa, para esta meta. */
export function fechasConActividad(metaId) {
  const conteo = {};
  Object.values(hechos(metaId)).forEach((f) => { conteo[f] = (conteo[f] || 0) + 1; });
  return conteo;
}
/** Fusiona progreso venido de otro dispositivo: unión de hechos, gana la fecha más antigua. */
export function fusionarProgreso(remoto) {
  if (!remoto || typeof remoto !== 'object') return false;
  let cambios = false;
  for (const [metaId, datos] of Object.entries(remoto)) {
    if (!datos || !datos.hechos) continue;
    if (!estado.progreso[metaId]) { estado.progreso[metaId] = { hechos: {} }; }
    for (const [n, fecha] of Object.entries(datos.hechos)) {
      const local = estado.progreso[metaId].hechos[n];
      if (!local || fecha < local) { estado.progreso[metaId].hechos[n] = fecha; cambios = true; }
    }
  }
  if (cambios) guardar();
  return cambios;
}

// ---------- ajustes ----------
export function ajustar(parche) {
  estado.ajustes = {
    ...estado.ajustes, ...parche,
    github: { ...estado.ajustes.github, ...(parche.github || {}) },
    notificaciones: { ...estado.ajustes.notificaciones, ...(parche.notificaciones || {}) },
  };
  guardar();
}
export function reiniciarTodo() {
  estado = porDefecto();
  guardar();
}
export function exportar() { return JSON.stringify(estado, null, 1); }
export function importar(texto) {
  const datos = JSON.parse(texto);
  if (!datos || !Array.isArray(datos.metas)) throw new Error('Formato no reconocido');
  estado = { ...porDefecto(), ...datos };
  guardar();
}
