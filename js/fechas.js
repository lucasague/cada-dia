// Utilidades de fecha en hora local del dispositivo. Todo en 'YYYY-MM-DD'.

export function aISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}
export function deISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export const hoyISO = () => aISO(new Date());
export function sumarDias(iso, n) {
  const d = deISO(iso); d.setDate(d.getDate() + n); return aISO(d);
}
export function diasEntre(a, b) {
  return Math.round((deISO(b) - deISO(a)) / 86400000);
}

const FMT_LARGO = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const FMT_CORTO = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const FMT_MES = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
export const fechaLarga = (iso = hoyISO()) => { const t = FMT_LARGO.format(deISO(iso)); return t.charAt(0).toUpperCase() + t.slice(1); };
export const fechaCorta = (iso) => FMT_CORTO.format(deISO(iso));
export const nombreMes = (y, m) => { const t = FMT_MES.format(new Date(y, m, 1)); return t.charAt(0).toUpperCase() + t.slice(1); };
export const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Rachas a partir de un mapa { 'YYYY-MM-DD': cantidad }.
 * La racha actual cuenta hacia atrás desde hoy; si hoy aún no hay nada, desde ayer
 * (todavía no está rota: queda el día por delante).
 */
export function calcularRachas(actividad, hoy = hoyISO()) {
  const fechas = Object.keys(actividad).filter((f) => actividad[f] > 0).sort();
  let actual = 0;
  let cursor = actividad[hoy] ? hoy : sumarDias(hoy, -1);
  while (actividad[cursor]) { actual += 1; cursor = sumarDias(cursor, -1); }

  let mejor = 0, corrida = 0, anterior = null;
  for (const f of fechas) {
    corrida = anterior && diasEntre(anterior, f) === 1 ? corrida + 1 : 1;
    if (corrida > mejor) mejor = corrida;
    anterior = f;
  }
  return { actual, mejor, diasTotales: fechas.length, hoyHecho: Boolean(actividad[hoy]) };
}

/** Últimos 7 días acabando en hoy: [{ iso, letra, hecho, esHoy }]. */
export function ultimaSemana(actividad, hoy = hoyISO()) {
  const salida = [];
  for (let i = 6; i >= 0; i--) {
    const iso = sumarDias(hoy, -i);
    const d = deISO(iso);
    salida.push({ iso, letra: DIAS_SEMANA[(d.getDay() + 6) % 7], hecho: Boolean(actividad[iso]), esHoy: i === 0, dia: d.getDate() });
  }
  return salida;
}

/** Celdas del mes (lunes primero), con huecos iniciales como null. */
export function celdasMes(y, m, actividad, inicioMeta, hoy = hoyISO()) {
  const primero = new Date(y, m, 1);
  const huecos = (primero.getDay() + 6) % 7;
  const total = new Date(y, m + 1, 0).getDate();
  const celdas = Array.from({ length: huecos }, () => null);
  for (let d = 1; d <= total; d++) {
    const iso = aISO(new Date(y, m, d));
    celdas.push({
      iso, dia: d,
      hecho: Boolean(actividad[iso]), cantidad: actividad[iso] || 0,
      esHoy: iso === hoy, futuro: iso > hoy,
      fallo: !actividad[iso] && iso < hoy && (!inicioMeta || iso >= inicioMeta),
    });
  }
  return celdas;
}
