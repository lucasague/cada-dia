// Punto de entrada: enrutado por hash, cabecera, navegación y ciclo de render.
import * as estado from './estado.js';
import { cargarPack, listarPacks } from './contenido.js';
import { hoyISO, fechaLarga, calcularRachas } from './fechas.js';
import { I } from './iconos.js';
import * as vistas from './vistas.js';
import * as sync from './sincronizar.js';

window.__CADADIA_VERSION = '1.0.0';

const raiz = document.getElementById('app');
const RUTAS = [
  { hash: '#/hoy', titulo: 'Hoy', icono: I.hoy },
  { hash: '#/lista', titulo: 'Cantos', icono: I.lista },
  { hash: '#/calendario', titulo: 'Calendario', icono: I.calendario },
  { hash: '#/ajustes', titulo: 'Ajustes', icono: I.ajustes },
];

let packActual = null;
let toastTemporizador = null;

function toast(texto) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
  el.textContent = texto;
  requestAnimationFrame(() => el.classList.add('visible'));
  clearTimeout(toastTemporizador);
  toastTemporizador = setTimeout(() => el.classList.remove('visible'), 2600);
}

function navegar(hash, reemplazar = false) {
  if (reemplazar && location.hash === hash) { render(); return; }
  if (reemplazar) history.replaceState(null, '', hash); else location.hash = hash;
  if (reemplazar) render();
}

async function contexto() {
  const est = estado.obtener();
  const meta = estado.metaActiva();
  let pack = null;
  if (meta) {
    try { pack = await cargarPack(meta.pack); } catch (e) { console.error(e); }
    packActual = pack;
  }
  const hechos = meta ? estado.hechos(meta.id) : {};
  const actividad = meta ? estado.fechasConActividad(meta.id) : {};
  const hoy = hoyISO();
  return { estado: est, meta, pack, hechos, actividad, rachas: calcularRachas(actividad, hoy), hoy, navegar, toast };
}

function nombreUnidadPlural(pack) {
  if (!pack) return 'Lista';
  const u = pack.unidad || 'ítem';
  return u.charAt(0).toUpperCase() + u.slice(1) + 's';
}

function concha(ctx, ruta) {
  const fecha = fechaLarga(ctx.hoy);
  RUTAS[1].titulo = nombreUnidadPlural(ctx.pack);
  return `
    <nav class="nav" aria-label="Secciones">
      <div class="nav__marca">${I.marca} Cada día</div>
      ${RUTAS.map((r) => `<button class="nav__item ${ruta === r.hash ? 'activo' : ''}" data-ir="${r.hash}">${r.icono}<span>${r.titulo}</span></button>`).join('')}
    </nav>
    <div class="capa">
      <header class="cabecera"><div class="cabecera__marca">${I.marca} Cada día</div><div class="cabecera__fecha">${fecha}</div></header>
      <main class="contenido ${ruta === '#/leer' ? 'contenido--lectura' : ''}" id="vista"></main>
    </div>`;
}

let ultimaRutaBase = null;
async function render() {
  const ctx = await contexto();
  const hash = location.hash || '#/hoy';
  const [base, arg] = hash.split('/').length > 2 ? [hash.split('/').slice(0, 2).join('/'), hash.split('/')[2]] : [hash, null];
  let vista;
  switch (base) {
    case '#/leer': vista = vistas.vistaLeer(ctx, arg); break;
    case '#/lista': vista = vistas.vistaLista(ctx); break;
    case '#/calendario': vista = vistas.vistaCalendario(ctx); break;
    case '#/ajustes': vista = vistas.vistaAjustes(ctx); break;
    default: vista = vistas.vistaHoy(ctx);
  }
  const anterior = document.getElementById('vista');
  if (anterior && anterior._limpiar) anterior._limpiar();
  const cambioDeRuta = ultimaRutaBase !== base || !anterior;
  if (cambioDeRuta) {
    raiz.innerHTML = concha(ctx, base === '#/leer' ? '#/leer' : base);
    ultimaRutaBase = base;
  } else {
    raiz.querySelectorAll('.nav__item').forEach((b) => b.classList.toggle('activo', b.dataset.ir === base));
  }
  const cont = document.getElementById('vista');
  cont.innerHTML = vista.html;
  if (vista.montar) vista.montar(cont);
  // Solo al cambiar de sección: si se repinta la misma (p. ej. al cambiar un ajuste), no saltar arriba.
  if (base !== '#/leer' && cambioDeRuta) window.scrollTo({ top: 0 });
  raiz._ctx = ctx;
}

// Eventos delegados
raiz.addEventListener('click', (ev) => { vistas.manejarAccion(ev, raiz._ctx).catch((e) => { console.error(e); toast(e.message); }); });
raiz.addEventListener('change', (ev) => vistas.manejarCambio(ev, raiz._ctx));
raiz.addEventListener('input', (ev) => vistas.manejarEntrada(ev));
window.addEventListener('hashchange', render);
estado.suscribir(() => { if (!location.hash.startsWith('#/leer')) render(); });

async function primerArranque() {
  const est = estado.obtener();
  vistas.aplicarTema(est.ajustes.tema);
  document.documentElement.style.setProperty('--escala-lectura', estado.escalaLectura());
  if (est.metas.length === 0) {
    try {
      const packs = await listarPacks();
      if (packs[0]) estado.crearMeta({ pack: packs[0].id, titulo: packs[0].titulo });
    } catch (e) { console.error(e); }
  }
}

async function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo && nuevo.addEventListener('statechange', () => { if (nuevo.state === 'installed' && navigator.serviceWorker.controller) toast('Nueva versión lista: recarga la app'); });
    });
  } catch (e) { console.warn('SW', e); }
}

(async () => {
  await primerArranque();
  await render();
  registrarSW();
  // Al abrir y al volver a primer plano, traer el progreso del otro dispositivo.
  const sincronizar = () => sync.bajarProgreso().then((c) => { if (c) { toast('Progreso actualizado desde GitHub'); render(); } }).catch((e) => console.warn('sync', e));
  sincronizar();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { sincronizar(); if (!location.hash.startsWith('#/leer')) render(); } });
})();
