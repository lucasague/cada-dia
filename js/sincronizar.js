// Sincronización opcional con el repo privado de datos (GitHub):
//   - progreso.json      -> el mismo progreso en móvil y escritorio, y lo que el recordatorio necesita
//                           para decir "hoy toca el Canto X".
//   - suscripciones.json -> suscripciones Web Push de cada dispositivo, con su hora y zona horaria.
// Si no hay token configurado, todo esto es un no-op y la app funciona igual en local.

import * as estado from './estado.js';
import { actualizarJSON, leerJSON } from './github.js';

const RUTA_PROGRESO = 'progreso.json';
const RUTA_SUSCRIPCIONES = 'suscripciones.json';

export function configurado() {
  const g = estado.obtener().ajustes.github;
  return Boolean(g && g.token && g.repo);
}
const cfg = () => estado.obtener().ajustes.github;

export function idDispositivo() {
  const a = estado.obtener().ajustes;
  if (a.dispositivo) return a.dispositivo;
  const id = 'd-' + Math.random().toString(36).slice(2, 10);
  estado.ajustar({ dispositivo: id });
  return id;
}

// Cada dispositivo crea su meta al arrancar con un id propio (pack + hora), así que la misma meta
// ("la Comedia") llega del otro dispositivo con otro id. Se casa por pack: el progreso remoto de una
// meta que aquí no existe se apunta a la meta local del mismo pack, en vez de quedar huérfano.
function progresoCasado(progresoRemoto, metasRemotas) {
  const local = estado.obtener();
  const salida = {};
  for (const [metaId, datos] of Object.entries(progresoRemoto || {})) {
    let destino = metaId;
    if (!local.metas.some((m) => m.id === metaId)) {
      const remota = (metasRemotas || []).find((m) => m.id === metaId);
      const pack = remota ? remota.pack : metaId.replace(/-[a-z0-9]+$/, '');
      const gemela = local.metas.find((m) => m.pack === pack);
      if (gemela) destino = gemela.id;
    }
    if (!salida[destino]) salida[destino] = { hechos: {} };
    for (const [n, fecha] of Object.entries((datos && datos.hechos) || {})) {
      const previo = salida[destino].hechos[n];
      if (!previo || fecha < previo) salida[destino].hechos[n] = fecha;
    }
  }
  return salida;
}

let temporizador = null;
/** Sube el progreso (con retardo para agrupar varios cambios seguidos). */
export function programarSubidaProgreso() {
  if (!configurado()) return;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => subirProgreso().catch((e) => console.warn('Sync progreso', e)), 1500);
}

export async function subirProgreso() {
  if (!configurado()) return;
  const local = estado.obtener();
  await actualizarJSON(cfg(), RUTA_PROGRESO, (remoto) => {
    // Unión: gana la fecha más antigua por ítem. Después fusionamos lo remoto en local también.
    const salida = { actualizado: new Date().toISOString(), metas: local.metas, progreso: {} };
    const fuentes = [remoto && progresoCasado(remoto.progreso, remoto.metas), local.progreso];
    for (const fuente of fuentes) {
      if (!fuente) continue;
      for (const [metaId, datos] of Object.entries(fuente)) {
        if (!salida.progreso[metaId]) salida.progreso[metaId] = { hechos: {} };
        for (const [n, fecha] of Object.entries((datos && datos.hechos) || {})) {
          const previo = salida.progreso[metaId].hechos[n];
          if (!previo || fecha < previo) salida.progreso[metaId].hechos[n] = fecha;
        }
      }
    }
    estado.fusionarProgreso(salida.progreso);
    return salida;
  }, 'progreso: ' + new Date().toISOString().slice(0, 16));
}

/** Descarga el progreso remoto y lo funde con el local. Devuelve true si algo cambió. */
export async function bajarProgreso() {
  if (!configurado()) return false;
  const { datos } = await leerJSON(cfg(), RUTA_PROGRESO);
  if (!datos) return false;
  // Metas que existen en remoto y no aquí, de un pack que aquí no hay (si el pack ya está, se casan).
  const local = estado.obtener();
  let nuevasMetas = false;
  for (const m of datos.metas || []) {
    if (!local.metas.some((x) => x.id === m.id || x.pack === m.pack)) { local.metas.push({ ...m, activa: local.metas.length === 0 }); nuevasMetas = true; }
  }
  const cambio = estado.fusionarProgreso(progresoCasado(datos.progreso, datos.metas));
  if (nuevasMetas) estado.ajustar({});
  return cambio || nuevasMetas;
}

export async function guardarSuscripcion(suscripcion, hora) {
  if (!configurado()) throw new Error('Falta el token de GitHub');
  const id = idDispositivo();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Costa_Rica';
  const meta = estado.metaActiva();
  const entrada = {
    id, endpoint: suscripcion.endpoint, keys: suscripcion.keys, hora, tz,
    metaId: meta ? meta.id : null, pack: meta ? meta.pack : null,
    agente: navigator.userAgent.slice(0, 80), actualizado: new Date().toISOString(),
  };
  await actualizarJSON(cfg(), RUTA_SUSCRIPCIONES, (lista) => {
    const arr = Array.isArray(lista) ? lista : [];
    const resto = arr.filter((s) => s.id !== id && s.endpoint !== suscripcion.endpoint);
    return [...resto, entrada];
  }, `suscripcion ${id} ${hora} ${tz}`);
}

export async function borrarSuscripcion() {
  if (!configurado()) return;
  const id = idDispositivo();
  await actualizarJSON(cfg(), RUTA_SUSCRIPCIONES, (lista) => (Array.isArray(lista) ? lista : []).filter((s) => s.id !== id), `baja ${id}`);
}
