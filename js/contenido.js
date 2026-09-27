// Carga de paquetes de contenido. Un paquete = contenido/<id>.json con la forma:
//   { id, titulo, autor, unidad, secciones: [{id, titulo}], items: [{ n, seccion, numero, titulo, subtitulo, parrafos }] }
//
// OPCIONAL Y RETROCOMPATIBLE (paquetes actuales sin estos campos se pintan exactamente igual que ahora):
//   NIVEL DE PAQUETE:
//     - formato: "verso" (ausente = prosa)
//     - original: { idioma: "it", nombre: "Italiano" }
//   NIVEL DE ÍTEM:
//     - argumento: string (resumen del canto; se pinta antes del texto, en cursiva, color tinta-2, tamaño algo menor)
//     - parrafos_original: string[] (MISMA longitud que parrafos, alineado índice a índice; en verso, cada entrada es una estrofa con versos separados por "\n")
//
// En extracto(): si el texto contiene "\n", se sustituyen por " / " antes de recortar.
//
// La lista de paquetes disponibles está en contenido/index.json.

const cache = new Map();
const COLORES = ['var(--infierno)', 'var(--purgatorio)', 'var(--paraiso)', 'var(--oro)', 'var(--exito)'];

export async function listarPacks() {
  const r = await fetch('contenido/index.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('No se pudo cargar contenido/index.json');
  return (await r.json()).packs;
}

export async function cargarPack(id) {
  if (cache.has(id)) return cache.get(id);
  const r = await fetch(`contenido/${id}.json`);
  if (!r.ok) throw new Error(`No se pudo cargar el paquete ${id}`);
  const pack = await r.json();
  pack.items.sort((a, b) => a.n - b.n);
  pack.porN = new Map(pack.items.map((it) => [it.n, it]));
  pack.secciones = (pack.secciones || []).map((s, i) => ({ ...s, color: s.color || COLORES[i % COLORES.length] }));
  pack.colorSeccion = (sid) => (pack.secciones.find((s) => s.id === sid) || {}).color || 'var(--oro)';
  cache.set(id, pack);
  return pack;
}

/** Siguiente ítem pendiente (el más bajo no hecho) o null si está todo. */
export function siguientePendiente(pack, hechos) {
  return pack.items.find((it) => !hechos[it.n]) || null;
}

export function extracto(item, largo = 180) {
  const t = ((item.parrafos && item.parrafos[0]) || '').replace(/\[\d+\]/g, '').replace(/\n/g, ' / ');
  if (t.length <= largo) return t;
  const corte = t.lastIndexOf(' ', largo);
  return t.slice(0, corte > 60 ? corte : largo) + '…';
}
