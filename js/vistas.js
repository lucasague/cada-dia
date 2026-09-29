// Vistas de la app. Cada vista es una función (ctx) => { html, montar(el) }.
// ctx: { estado, meta, pack, hechos, actividad, rachas, navegar, toast, hoy }

import * as estado from './estado.js';
import { I } from './iconos.js';
import { siguientePendiente, extracto, listarPacks } from './contenido.js';
import { hoyISO, fechaCorta, ultimaSemana, celdasMes, nombreMes, DIAS_SEMANA, sumarDias, deISO, aISO } from './fechas.js';
import { lanzarConfeti } from './confeti.js';
import * as notif from './notificaciones.js';
import * as sync from './sincronizar.js';
import { comprobarToken } from './github.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Marcadores [n] de nota al pie -> superíndice enlazado a la nota.
const conNotas = (html) => html.replace(/\[(\d+)\]/g, (_, n) => `<sup class="nota-ref"><a href="#nota-${n}" data-nota="${n}">${n}</a></sup>`);

// tam=74 (aro grande, con número en el centro) o más pequeño para usarlo como icono de fila
// (sin `texto`, p. ej. en el panel compacto de "Hoy").
function anillo(pct, texto, tam = 74) {
  const grosor = tam < 50 ? 4 : 7;
  const r = tam / 2 - grosor, c = 2 * Math.PI * r;
  return `<div class="anillo" style="width:${tam}px;height:${tam}px">
    <svg viewBox="0 0 ${tam} ${tam}"><defs><linearGradient id="gradOro" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="var(--oro)"/><stop offset="1" stop-color="var(--oro-2)"/></linearGradient></defs>
      <circle class="anillo__fondo" cx="${tam / 2}" cy="${tam / 2}" r="${r}" stroke-width="${grosor}"/>
      <circle class="anillo__valor" cx="${tam / 2}" cy="${tam / 2}" r="${r}" stroke-width="${grosor}" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-final="${c * (1 - pct)}"/>
    </svg>${texto ? `<div class="anillo__centro">${texto}</div>` : ''}</div>`;
}

// Fila compacta al estilo de una lista densa (icono + texto + valor a la derecha):
// mismo espíritu que las filas de /programas en im-app, para el panel de arriba de "Hoy".
function filaPanel(icono, titulo, sub, valor, unidadValor) {
  return `<div class="panel-fila">
    <div class="panel-fila__icono">${icono}</div>
    <div class="panel-fila__txt"><div class="panel-fila__titulo">${titulo}</div><div class="panel-fila__sub">${sub}</div></div>
    <div class="panel-fila__valor">${valor}${unidadValor ? `<span>${unidadValor}</span>` : ''}</div>
  </div>`;
}

function semana(actividad) {
  return `<div class="semana">${ultimaSemana(actividad).map((d, i) => `
    <div class="dia ${d.hecho ? 'dia--hecho' : ''} ${d.esHoy ? 'dia--hoy' : ''}">
      <div class="dia__marca" style="animation-delay:${i * 40}ms">${d.hecho ? I.check : d.dia}</div><span>${d.letra}</span>
    </div>`).join('')}</div>`;
}

const fraseRacha = (r) => {
  if (r.actual === 0) return r.diasTotales ? 'La racha se rompió. Hoy se reanuda.' : 'Empieza hoy la racha.';
  if (!r.hoyHecho) return `${r.actual} día${r.actual > 1 ? 's' : ''} seguidos. Hoy toca mantenerla.`;
  if (r.actual === 1) return 'Primer día. Ya está en marcha.';
  if (r.actual < 7) return `${r.actual} días seguidos.`;
  if (r.actual < 30) return `${r.actual} días seguidos. Esto ya es un hábito.`;
  return `${r.actual} días seguidos. Imparable.`;
};

// ------------------------------------------------------------------ HOY
export function vistaHoy(ctx) {
  const { meta, pack, hechos, actividad, rachas } = ctx;
  if (!meta || !pack) return { html: `<div class="vacio">No hay ninguna meta activa.<br><button class="boton boton--oro mt" data-ir="#/ajustes">Crear una</button></div>` };
  const total = pack.items.length;
  const hechosN = Object.keys(hechos).length;
  const siguiente = siguientePendiente(pack, hechos);
  const hoyHecho = rachas.hoyHecho;
  const ultimoHoy = Object.entries(hechos).filter(([, f]) => f === ctx.hoy).map(([n]) => Number(n)).sort((a, b) => b - a)[0];
  const itemHoy = hoyHecho && ultimoHoy ? pack.porN.get(ultimoHoy) : siguiente;
  const restantes = total - hechosN;
  const fin = restantes > 0 ? sumarDias(ctx.hoy, restantes - (hoyHecho ? 0 : 1)) : null;

  let hero;
  if (!itemHoy) {
    hero = `<div class="tarjeta tarjeta--hero celebracion"><div class="celebracion__icono">🏛️</div><h2>${esc(pack.titulo)}: completo</h2><p class="hero__sub">Los ${total} ${esc(pack.unidad)}s leídos. ${rachas.mejor} días fue tu mejor racha.</p></div>`;
  } else {
    const color = pack.colorSeccion(itemHoy.seccion);
    const seccion = (pack.secciones.find((s) => s.id === itemHoy.seccion) || {}).titulo || '';
    hero = `<div class="tarjeta tarjeta--hero">
      <div class="etiqueta etiqueta--seccion" style="--color-seccion:${color}">${hoyHecho ? 'Hecho hoy' : 'Hoy toca'} · ${esc(seccion)}</div>
      <h1 class="hero__titulo">${esc(itemHoy.titulo)}</h1>
      <p class="hero__sub">${esc(pack.titulo)} · ${itemHoy.n} de ${total}</p>
      <p class="hero__extracto">${esc(extracto(itemHoy, 200))}</p>
      <div class="hero__acciones">
        <button class="boton ${hoyHecho ? 'boton--secundario' : 'boton--oro'}" data-ir="#/leer/${itemHoy.n}">${I.libro} ${hoyHecho ? 'Releer' : 'Leer ahora'}</button>
        ${hoyHecho && siguiente ? `<button class="boton boton--secundario" data-ir="#/leer/${siguiente.n}">Adelantar el ${esc(siguiente.titulo)}</button>` : ''}
      </div>
    </div>`;
  }

  const html = `<div class="vista vista-hoy">
    ${hero}
    <div class="tarjeta bloque panel">
      ${filaPanel(anillo(hechosN / total, '', 34), `${esc(pack.unidad)}s leídos`, fin ? `Acabas el ${fechaCorta(fin)}` : '¡Meta cumplida!', hechosN, `/${total}`)}
      ${filaPanel(`<div class="llama llama--fila ${rachas.actual ? '' : 'llama--apagada'}">${I.llama}</div>`, esc(fraseRacha(rachas)), `Mejor racha: ${rachas.mejor} días`, rachas.actual, 'días')}
      ${semana(actividad)}
    </div>
    <div class="tarjeta bloque">
      <div class="fila"><div class="grow"><div class="etiqueta">Meta</div><div class="campo__titulo">${esc(meta.titulo)}</div><div class="nota">Un ${esc(pack.unidad)} al día desde el ${fechaCorta(meta.inicio)}. Mejor racha: ${rachas.mejor} días. Días activos: ${rachas.diasTotales}.</div></div></div>
      <div class="barra"><div class="barra__valor" data-final="${(hechosN / total) * 100}%"></div></div>
      <div class="barra-secciones">${pack.secciones.map((s) => { const its = pack.items.filter((i) => i.seccion === s.id); const h = its.filter((i) => hechos[i.n]).length; return `<div style="--color-seccion:${s.color}" title="${esc(s.titulo)} ${h}/${its.length}"><i data-final="${(h / its.length) * 100}%"></i></div>`; }).join('')}</div>
      <div class="leyenda">${pack.secciones.map((s) => `<span style="--color-seccion:${s.color}">${esc(s.titulo)}</span>`).join('')}</div>
    </div>
  </div>`;

  return { html, montar: animarBarras };
}

function animarBarras(el) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.querySelectorAll('[data-final]').forEach((n) => {
      if (n.classList.contains('anillo__valor')) n.style.strokeDashoffset = n.dataset.final;
      else n.style.width = n.dataset.final;
    });
  }));
}

// ------------------------------------------------------------------ LEER
export function vistaLeer(ctx, n) {
  const { pack, meta, hechos } = ctx;
  const item = pack && pack.porN.get(Number(n));
  if (!item) return { html: `<div class="vacio">No existe ese ${esc((pack && pack.unidad) || 'ítem')}.</div>` };
  const hecho = Boolean(hechos[item.n]);
  const color = pack.colorSeccion(item.seccion);
  const seccion = (pack.secciones.find((s) => s.id === item.seccion) || {}).titulo || '';
  const ant = pack.porN.get(item.n - 1), sig = pack.porN.get(item.n + 1);

  // Detectar si hay paralelo
  const hayParalelo = item.parrafos_original && item.parrafos_original.length === item.parrafos.length;

  // Generar contenido de texto
  let contenidoTexto = '';
  if (item.argumento) {
    contenidoTexto += `<p class="argumento">${esc(item.argumento)}</p>`;
  }
  contenidoTexto += item.parrafos.map((p, i) => {
    if (pack.formato === 'verso') {
      // Verso: cada verso en su propio span
      const versos = p.split('\n');
      const htmlEspanol = versos.map(v => `<span class="verso">${conNotas(esc(v))}</span>`).join('');

      if (hayParalelo) {
        const versosOrig = item.parrafos_original[i].split('\n');
        const htmlOriginal = versosOrig.map(v => `<span class="verso">${conNotas(esc(v))}</span>`).join('');
        return `<div class="paralelo"><div class="paralelo__pista"><div class="paralelo__cara paralelo__cara--original" lang="it">${htmlOriginal}</div><div class="paralelo__cara" lang="es">${htmlEspanol}</div></div></div>`;
      }
      return `<div class="estrofa">${htmlEspanol}</div>`;
    } else {
      // Prosa
      if (hayParalelo) {
        return `<div class="paralelo"><div class="paralelo__pista"><div class="paralelo__cara paralelo__cara--original" lang="it">${conNotas(esc(item.parrafos_original[i]))}</div><div class="paralelo__cara" lang="es">${conNotas(esc(p))}</div></div></div>`;
      }
      return `<p>${conNotas(esc(p))}</p>`;
    }
  }).join('');

  const html = `<div class="vista">
    <div class="progreso-lectura" id="progresoLectura"></div>
    <div class="lectura__cab">
      <button class="boton-icono" data-ir="#/hoy" aria-label="Volver">${I.atras}</button>
      <label class="control-letra"><span class="control-letra__a">A</span><input type="range" min="0" max="${estado.PASOS_LECTURA}" step="1" value="${ctx.estado.ajustes.pasoLectura}" data-letra aria-label="Tamaño del texto"><span class="control-letra__a control-letra__a--gr">A</span></label>
      ${hayParalelo ? `<button class="boton-icono" data-lang aria-pressed="false" aria-label="Ver el original en ${esc((pack.original && pack.original.nombre) || 'italiano')}">${esc(((pack.original && pack.original.idioma) || 'it').toUpperCase())}</button>` : ''}
    </div>
    <div class="etiqueta etiqueta--seccion" style="--color-seccion:${color}">${esc(seccion)} · ${item.n} de ${pack.items.length}</div>
    <h1 class="lectura__titulo">${esc(item.titulo)}</h1>
    <p class="lectura__sub">${esc(pack.titulo)} · ${esc(pack.autor || '')}</p>
    <div class="lectura__texto" ${hayParalelo ? 'style="--desliz: 0" data-paralelo' : ''}>${contenidoTexto}</div>
    ${hayParalelo ? `<div class="paralelo-indicador" data-indicador aria-hidden="true">${esc((pack.original && pack.original.nombre) || 'Original')} · desliza ← para volver</div>` : ''}
    ${item.notas && item.notas.length ? `<ol class="lectura__notas">${item.notas.map((nt) => `<li id="nota-${nt.n}" value="${nt.n}">${esc(nt.texto)}</li>`).join('')}</ol>` : ''}
    <div class="lectura__pie">
      ${hecho
        ? `<div class="lectura__hecho"><span class="check check--hecho">${I.check}</span> Leído el ${fechaCorta(hechos[item.n])}</div><button class="boton boton--secundario" data-desmarcar="${item.n}">Desmarcar</button>`
        : `<div class="lectura__hecho lectura__hecho--pendiente" data-fin><span class="check">${I.check}</span> Se marca como leído al llegar al final</div>`}
      <div class="lectura__navs">
        ${ant ? `<button class="boton boton--secundario" data-ir="#/leer/${ant.n}">${I.atras} ${esc(ant.titulo)}</button>` : '<span></span>'}
        ${sig ? `<button class="boton boton--secundario" data-ir="#/leer/${sig.n}">${esc(sig.titulo)} ${I.adelante}</button>` : '<span></span>'}
      </div>
    </div>
  </div>`;

  const montar = (el) => {
    window.scrollTo({ top: 0 });
    const barra = el.querySelector('#progresoLectura');
    const alScroll = () => {
      const h = document.documentElement;
      const pct = h.scrollHeight - h.clientHeight > 0 ? (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100 : 0;
      barra.style.width = pct + '%';
    };
    window.addEventListener('scroll', alScroll, { passive: true });

    // Se marca como leído solo al llegar al final del texto (orden de Lucas, 29/09/2026): cuando el
    // pie entra en pantalla. Los primeros segundos no cuentan, por si la maquetación aún no está hecha.
    const fin = el.querySelector('[data-fin]');
    let observador = null, recheck = null;
    if (fin) {
      const t0 = Date.now();
      const alFinal = () => {
        if (!fin.isConnected || estado.estaHecho(meta.id, item.n)) return;
        const r = fin.getBoundingClientRect();
        if (r.top > window.innerHeight || r.bottom < 0) return;
        if (Date.now() - t0 < 3000) { clearTimeout(recheck); recheck = setTimeout(alFinal, 3000 - (Date.now() - t0)); return; }
        observador.disconnect();
        const yaHoy = Object.values(estado.hechos(meta.id)).includes(hoyISO());
        estado.marcarHecho(meta.id, item.n);
        sync.programarSubidaProgreso();
        fin.classList.remove('lectura__hecho--pendiente');
        fin.innerHTML = `<span class="check check--hecho check--pop">${I.check}</span> Leído hoy`;
        const r2 = fin.getBoundingClientRect();
        lanzarConfeti({ origen: { x: r2.left + 20, y: r2.top + r2.height / 2 }, cantidad: yaHoy ? 60 : 140 });
        if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
        const total = pack.items.length, hechosN = Object.keys(estado.hechos(meta.id)).length;
        ctx.toast(hechosN === total ? '¡Meta completada!' : yaHoy ? 'Otro más. Vas adelantado.' : '¡Leído! Un día más en la racha.');
      };
      observador = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) alFinal(); });
      observador.observe(fin);
    }

    // Paralelo con el original: --desliz en .lectura__texto (0 = español, 1 = original).
    // Cada estrofa es una fila con las dos caras lado a lado; la fila mide lo que la más alta,
    // así que cambiar de idioma no mueve nada en vertical.
    const textoEl = el.querySelector('[data-paralelo]');
    if (textoEl) {
      const btnLang = el.querySelector('[data-lang]');
      const indicador = el.querySelector('[data-indicador]');
      const siglaOriginal = (pack.original && pack.original.idioma ? pack.original.idioma : 'it').toUpperCase();
      let estado = 0;       // lado en reposo: 0 español, 1 original
      let gesto = null;     // { x0, y0, t0, eje: null | 'h' | 'v', id }
      let ruedaAcum = 0, ruedaHasta = 0;

      const pintar = (valor) => {
        textoEl.style.setProperty('--desliz', valor);
        if (indicador) indicador.style.opacity = valor >= 0.5 ? '1' : '0';
      };
      const fijar = (destino) => {
        estado = destino;
        textoEl.classList.remove('arrastrando');
        pintar(destino);
        if (btnLang) {
          btnLang.setAttribute('aria-pressed', destino === 1 ? 'true' : 'false');
          btnLang.textContent = destino === 1 ? 'ES' : siglaOriginal;
          btnLang.setAttribute('aria-label', destino === 1 ? 'Volver al español' : `Ver el original en ${(pack.original && pack.original.nombre) || 'italiano'}`);
        }
      };

      try {
        if (!localStorage.getItem('cadadia.pistaParalelo')) {
          ctx.toast(`Desliza a la derecha para ver el original en ${((pack.original && pack.original.nombre) || 'italiano').toLowerCase()}`);
          localStorage.setItem('cadadia.pistaParalelo', '1');
        }
      } catch { /* sin localStorage: no pasa nada */ }

      if (btnLang) btnLang.addEventListener('click', () => fijar(estado === 1 ? 0 : 1));

      // Táctil / lápiz. Con touch-action: pan-y el navegador hace el scroll vertical él solo
      // (y manda pointercancel si lo toma); nosotros solo tratamos el movimiento horizontal.
      textoEl.addEventListener('pointerdown', (e) => {
        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
        gesto = e.clientX < 24 ? null : { x0: e.clientX, y0: e.clientY, t0: performance.now(), eje: null, id: e.pointerId };
      });
      textoEl.addEventListener('pointermove', (e) => {
        if (!gesto || e.pointerId !== gesto.id || gesto.eje === 'v') return;
        const dx = e.clientX - gesto.x0, dy = e.clientY - gesto.y0;
        if (!gesto.eje) {
          if (Math.hypot(dx, dy) < 10) return;
          if (Math.abs(dx) > 1.3 * Math.abs(dy)) {
            gesto.eje = 'h';
            try { textoEl.setPointerCapture(e.pointerId); } catch { /* ya liberado */ }
            textoEl.classList.add('arrastrando');
          } else { gesto.eje = 'v'; return; }
        }
        pintar(Math.max(0, Math.min(1, estado + dx / (textoEl.clientWidth || 1))));
      });
      const terminar = (e, cancelado) => {
        if (!gesto || e.pointerId !== gesto.id) return;
        const g = gesto; gesto = null;
        if (g.eje !== 'h') return;
        if (cancelado) { fijar(estado); return; }
        const dx = e.clientX - g.x0, dt = Math.max(1, performance.now() - g.t0);
        const decidido = Math.abs(dx) > textoEl.clientWidth * 0.25 || Math.abs(dx) / dt > 0.4;
        fijar(decidido ? (dx > 0 ? 1 : 0) : estado);
      };
      textoEl.addEventListener('pointerup', (e) => terminar(e, false));
      textoEl.addEventListener('pointercancel', (e) => terminar(e, true));

      // Trackpad (desplazamiento horizontal con dos dedos). Con desplazamiento "natural"
      // (macOS, Windows de precisión) mover los dedos a la derecha da deltaX negativo:
      // eso lleva al original, igual que el gesto táctil. Sin probar en un trackpad real.
      textoEl.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        e.preventDefault();
        const ahora = performance.now();
        if (ahora < ruedaHasta) return;
        ruedaAcum += e.deltaX;
        if (Math.abs(ruedaAcum) > 60) {
          fijar(ruedaAcum < 0 ? 1 : 0);
          ruedaAcum = 0;
          ruedaHasta = ahora + 400;
        }
      }, { passive: false });
    }

    // Los listeners del paralelo cuelgan de textoEl y se van con la vista.
    el._limpiar = () => { window.removeEventListener('scroll', alScroll); if (observador) observador.disconnect(); clearTimeout(recheck); };
  };
  return { html, montar };
}

// ------------------------------------------------------------------ LISTA
export function vistaLista(ctx) {
  const { pack, hechos } = ctx;
  if (!pack) return { html: '<div class="vacio">Sin contenido.</div>' };
  const siguiente = siguientePendiente(pack, hechos);
  const html = `<div class="vista">${pack.secciones.map((s) => {
    const its = pack.items.filter((i) => i.seccion === s.id);
    const h = its.filter((i) => hechos[i.n]).length;
    return `<div class="seccion-titulo"><h2 style="color:${s.color}">${esc(s.titulo)}</h2><span>${h}/${its.length}</span></div>
      <div class="lista">${its.map((it) => `
        <button class="item ${siguiente && siguiente.n === it.n ? 'item--hoy' : ''}" data-ir="#/leer/${it.n}">
          <div class="item__num">${it.numero}</div>
          <div class="item__cuerpo"><div class="item__titulo">${esc(it.titulo)}</div><div class="item__meta">${hechos[it.n] ? 'Leído el ' + fechaCorta(hechos[it.n]) : siguiente && siguiente.n === it.n ? 'Toca hoy' : esc(extracto(it, 70))}</div></div>
          ${hechos[it.n] ? `<span class="check check--hecho" data-toggle="${it.n}" role="button" aria-label="Desmarcar">${I.check}</span>` : `<span class="check">${I.check}</span>`}
        </button>`).join('')}</div>`;
  }).join('')}</div>`;
  const montar = (el) => {
    const objetivo = el.querySelector('.item--hoy');
    if (objetivo) setTimeout(() => objetivo.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150);
  };
  return { html, montar };
}

// ------------------------------------------------------------------ CALENDARIO
let mesVisto = null;
export function vistaCalendario(ctx) {
  const { actividad, rachas, meta, pack, hechos } = ctx;
  const hoy = deISO(ctx.hoy);
  if (!mesVisto) mesVisto = { y: hoy.getFullYear(), m: hoy.getMonth() };
  const celdas = celdasMes(mesVisto.y, mesVisto.m, actividad, meta ? meta.inicio : null, ctx.hoy);
  const total = pack ? pack.items.length : 0, hechosN = Object.keys(hechos).length;
  const restantes = total - hechosN;
  const fin = restantes > 0 ? sumarDias(ctx.hoy, restantes - (rachas.hoyHecho ? 0 : 1)) : null;
  const diasDesdeInicio = meta ? Math.max(1, Math.round((hoy - deISO(meta.inicio)) / 86400000) + 1) : 0;
  const cumplimiento = diasDesdeInicio ? Math.round((rachas.diasTotales / diasDesdeInicio) * 100) : 0;
  const html = `<div class="vista">
    <div class="tarjeta">
      <div class="meta-resumen">
        <div><div class="stat__num">${rachas.actual}</div><div class="stat__txt">racha actual</div></div>
        <div><div class="stat__num">${rachas.mejor}</div><div class="stat__txt">mejor racha</div></div>
        <div><div class="stat__num">${cumplimiento}%</div><div class="stat__txt">días cumplidos</div></div>
      </div>
      ${pack ? `<div class="barra"><div class="barra__valor" data-final="${(hechosN / total) * 100}%"></div></div>
      <p class="nota mt">${hechosN} de ${total} ${esc(pack.unidad)}s. ${fin ? `A este ritmo terminas el <b>${fechaCorta(fin)}</b>.` : '¡Meta cumplida!'}</p>` : ''}
    </div>
    <div class="tarjeta bloque">
      <div class="calendario__cab">
        <button class="boton-icono" data-mes="-1" aria-label="Mes anterior">${I.atras}</button>
        <div class="calendario__mes">${nombreMes(mesVisto.y, mesVisto.m)}</div>
        <button class="boton-icono" data-mes="1" aria-label="Mes siguiente">${I.adelante}</button>
      </div>
      <div class="calendario__grid">
        ${DIAS_SEMANA.map((d) => `<div class="calendario__dow">${d}</div>`).join('')}
        ${celdas.map((c, i) => c ? `<div class="celda ${c.hecho ? 'celda--hecho' : ''} ${c.esHoy ? 'celda--hoy' : ''} ${c.futuro ? 'celda--futuro' : ''} ${c.fallo ? 'celda--fallo' : ''}" style="animation-delay:${i * 12}ms" title="${c.iso}">${c.dia}${c.cantidad > 1 ? `<span class="celda__pts">×${c.cantidad}</span>` : ''}</div>` : '<div class="celda celda--vacia"></div>').join('')}
      </div>
      <div class="leyenda mt"><span style="--color-seccion:var(--oro)">día cumplido</span><span style="--color-seccion:color-mix(in srgb, var(--infierno) 40%, var(--fondo-2))">día sin lectura</span></div>
    </div>
  </div>`;
  return { html, montar: animarBarras };
}
export function moverMes(delta) {
  const d = new Date(mesVisto.y, mesVisto.m + delta, 1);
  mesVisto = { y: d.getFullYear(), m: d.getMonth() };
}

// ------------------------------------------------------------------ AJUSTES
export function vistaAjustes(ctx) {
  const a = ctx.estado.ajustes;
  const s = notif.soporte();
  const conToken = sync.configurado();
  const html = `<div class="vista">
    <div class="tarjeta">
      <div class="etiqueta">Recordatorio</div>
      <div class="campo"><div class="campo__txt"><div class="campo__titulo">Notificación diaria</div><div class="campo__desc">${s.push ? 'Te avisa a la hora elegida con lo que toca hoy.' : s.esIOS ? 'En iPhone: instala la app (Compartir → Añadir a pantalla de inicio) y ábrela desde el icono.' : 'Este navegador no soporta push.'}</div></div>
        <button class="interruptor" role="switch" aria-checked="${a.notificaciones.activas}" data-notif ${s.push ? '' : 'disabled'}></button></div>
      <div class="campo"><div class="campo__txt"><div class="campo__titulo">Hora</div><div class="campo__desc">Hora local de este dispositivo. Llega en la media hora siguiente.</div></div>
        <input type="time" value="${esc(a.notificaciones.hora)}" data-hora step="1800"></div>
      <div class="campo"><div class="campo__txt"><div class="campo__titulo">Probar</div><div class="campo__desc">Muestra una notificación local ahora mismo.</div></div>
        <button class="boton boton--secundario" data-probar ${s.push ? '' : 'disabled'}>${I.campana} Probar</button></div>
      <p class="nota nota--aviso mt" id="notifNota">${a.notificaciones.activas ? 'Activas. El envío lo hace GitHub Actions cada 30 minutos.' : 'Requiere el token de GitHub de abajo: ahí se guarda la suscripción del dispositivo.'}</p>
    </div>

    <div class="tarjeta bloque">
      <div class="etiqueta">Sincronización (GitHub)</div>
      <p class="nota mt">Guarda el progreso en tu repo privado <code>${esc(a.github.repo)}</code>. Así el móvil y el ordenador van a la par y el recordatorio sabe qué toca hoy.</p>
      <div class="campo campo--columna"><div class="campo__txt"><div class="campo__titulo">Token</div><div class="campo__desc">Fine-grained, solo ese repo, permiso Contents: read/write. Se guarda solo en este dispositivo.</div></div>
        <input type="password" value="${esc(a.github.token)}" data-token placeholder="github_pat_…" autocomplete="off"></div>
      <div class="campo campo--columna"><div class="campo__txt"><div class="campo__titulo">Repositorio</div></div><input type="text" value="${esc(a.github.repo)}" data-repo></div>
      <div class="fila mt"><button class="boton boton--primario" data-guardar-gh>${I.nube} Guardar y comprobar</button>${conToken ? `<button class="boton boton--secundario" data-sync>Sincronizar ahora</button>` : ''}</div>
      <p class="nota mt" id="ghNota">${conToken ? 'Configurado.' : 'Sin configurar: todo se guarda solo en este dispositivo.'}</p>
    </div>

    <div class="tarjeta bloque">
      <div class="etiqueta">Metas</div>
      ${ctx.estado.metas.map((m) => `<div class="campo"><div class="campo__txt"><div class="campo__titulo">${esc(m.titulo)}</div><div class="campo__desc">Desde el ${fechaCorta(m.inicio)} · ${Object.keys(estado.hechos(m.id)).length} hechos</div></div>
        ${m.activa ? '<span class="nota">Activa</span>' : `<button class="boton boton--secundario" data-activar="${m.id}">Activar</button>`}</div>`).join('')}
      <div class="campo"><div class="campo__txt"><div class="campo__titulo">Nueva meta</div><div class="campo__desc">Elige un contenido. Los paquetes están en <code>contenido/</code>.</div></div>
        <select data-pack><option value="">Cargando…</option></select></div>
      <div class="fila mt"><button class="boton boton--secundario" data-nueva-meta>${I.mas} Crear meta</button></div>
    </div>

    <div class="tarjeta bloque">
      <div class="etiqueta">Apariencia</div>
      <div class="campo"><div class="campo__txt"><div class="campo__titulo">Tema</div></div>
        <select data-tema><option value="auto" ${a.tema === 'auto' ? 'selected' : ''}>Automático</option><option value="claro" ${a.tema === 'claro' ? 'selected' : ''}>Claro</option><option value="oscuro" ${a.tema === 'oscuro' ? 'selected' : ''}>Oscuro</option></select></div>
      <div class="campo"><div class="campo__txt"><div class="campo__titulo">Texto</div><div class="campo__desc">Tamaño de lectura</div></div>
        <label class="control-letra"><input type="range" min="0" max="${estado.PASOS_LECTURA}" step="1" value="${a.pasoLectura}" data-letra aria-label="Tamaño del texto"><span data-letra-valor>${a.pasoLectura}</span></label></div>
    </div>

    <div class="tarjeta bloque">
      <div class="etiqueta">Datos</div>
      <div class="fila mt"><button class="boton boton--secundario" data-exportar>Exportar copia</button><label class="boton boton--secundario">Importar<input type="file" accept="application/json" data-importar class="oculto"></label><button class="boton boton--peligro" data-reiniciar>Borrar todo</button></div>
      <p class="nota mt">Versión ${esc(window.__CADADIA_VERSION || '1')} · <a href="https://github.com/lucasague/rutina" target="_blank" rel="noopener">código</a></p>
    </div>
  </div>`;

  const montar = async (el) => {
    const sel = el.querySelector('[data-pack]');
    try {
      const packs = await listarPacks();
      sel.innerHTML = packs.map((p) => `<option value="${esc(p.id)}">${esc(p.titulo)} (${p.total} ${esc(p.unidad)}s)</option>`).join('');
    } catch { sel.innerHTML = '<option value="">No se pudo cargar</option>'; }
  };
  return { html, montar };
}

// ------------------------------------------------------------------ acciones compartidas (delegación)
export async function manejarAccion(ev, ctx) {
  const ref = ev.target.closest('[data-nota]');
  if (ref) {
    ev.preventDefault();
    const nota = document.getElementById('nota-' + ref.dataset.nota);
    if (nota) { nota.scrollIntoView({ behavior: 'smooth', block: 'center' }); nota.classList.add('nota-activa'); setTimeout(() => nota.classList.remove('nota-activa'), 1800); }
    return true;
  }
  const t = ev.target.closest('[data-ir],[data-desmarcar],[data-toggle],[data-mes],[data-notif],[data-probar],[data-guardar-gh],[data-sync],[data-activar],[data-nueva-meta],[data-exportar],[data-reiniciar]');
  if (!t) return false;
  const d = t.dataset;
  const { meta, navegar, toast } = ctx;

  if (d.toggle !== undefined) {
    ev.preventDefault(); ev.stopPropagation();
    const n = Number(d.toggle);
    if (estado.estaHecho(meta.id, n)) estado.desmarcar(meta.id, n);
    else { estado.marcarHecho(meta.id, n); t.classList.add('check--pop'); }
    sync.programarSubidaProgreso();
    return true;
  }
  if (d.desmarcar !== undefined) { estado.desmarcar(meta.id, Number(d.desmarcar)); sync.programarSubidaProgreso(); navegar(location.hash, true); return true; }
  if (d.ir) { navegar(d.ir); return true; }
  if (d.mes) { moverMes(Number(d.mes)); navegar('#/calendario', true); return true; }
  if (d.notif !== undefined) {
    const activas = ctx.estado.ajustes.notificaciones.activas;
    const nota = document.getElementById('notifNota');
    try {
      if (activas) { await notif.desactivar(); toast('Notificaciones desactivadas'); }
      else { await notif.activar(ctx.estado.ajustes.notificaciones.hora); toast('Notificaciones activadas'); }
      navegar('#/ajustes', true);
    } catch (e) { nota.textContent = e.message; nota.classList.add('nota--error'); }
    return true;
  }
  if (d.probar !== undefined) {
    try {
      if (Notification.permission !== 'granted') await Notification.requestPermission();
      const sig = ctx.pack && siguientePendiente(ctx.pack, ctx.hechos);
      await notif.probar(sig ? `Hoy toca: ${sig.subtitulo || sig.titulo}` : 'Hoy toca tu lectura.');
    } catch (e) { toast('No se pudo: ' + e.message); }
    return true;
  }
  if (d.guardarGh !== undefined) {
    const token = document.querySelector('[data-token]').value.trim();
    const repo = document.querySelector('[data-repo]').value.trim();
    const nota = document.getElementById('ghNota');
    estado.ajustar({ github: { token, repo } });
    if (!token) { nota.textContent = 'Token vacío: sincronización desactivada.'; return true; }
    nota.textContent = 'Comprobando…';
    try {
      const r = await comprobarToken({ token, repo });
      if (!r.permisos || !r.permisos.push) throw new Error('El token no tiene permiso de escritura (Contents: read/write).');
      nota.classList.remove('nota--error');
      nota.textContent = 'Token válido. Sincronizando progreso…';
      await sync.bajarProgreso(); await sync.subirProgreso();
      nota.textContent = 'Configurado y sincronizado.';
      toast('GitHub conectado');
      navegar('#/ajustes', true);
    } catch (e) { nota.textContent = e.message; nota.classList.add('nota--error'); }
    return true;
  }
  if (d.sync !== undefined) {
    const nota = document.getElementById('ghNota');
    nota.textContent = 'Sincronizando…';
    try { await sync.bajarProgreso(); await sync.subirProgreso(); nota.textContent = 'Sincronizado ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); toast('Sincronizado'); }
    catch (e) { nota.textContent = e.message; nota.classList.add('nota--error'); }
    return true;
  }
  if (d.activar) { estado.activarMeta(d.activar); toast('Meta activada'); navegar('#/hoy'); return true; }
  if (d.nuevaMeta !== undefined) {
    const sel = document.querySelector('[data-pack]');
    const packs = await listarPacks();
    const p = packs.find((x) => x.id === sel.value);
    if (!p) return true;
    estado.crearMeta({ pack: p.id, titulo: p.titulo, recordatorio: ctx.estado.ajustes.notificaciones.hora });
    sync.programarSubidaProgreso();
    toast(`Meta creada: ${p.titulo}`);
    navegar('#/hoy');
    return true;
  }
  if (d.exportar !== undefined) {
    const blob = new Blob([estado.exportar()], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cada-dia-${hoyISO()}.json`; a.click();
    return true;
  }
  if (d.reiniciar !== undefined) {
    if (t.dataset.confirmado) { estado.reiniciarTodo(); toast('Todo borrado'); navegar('#/hoy'); }
    else { t.dataset.confirmado = '1'; t.textContent = '¿Seguro? Pulsa otra vez'; setTimeout(() => { delete t.dataset.confirmado; t.textContent = 'Borrar todo'; }, 4000); }
    return true;
  }
  return false;
}

// Mientras se arrastra la barrita del tamaño: se ve al momento, sin repintar la vista.
export function manejarEntrada(ev) {
  const t = ev.target;
  if (!t.matches('[data-letra]')) return;
  document.documentElement.style.setProperty('--escala-lectura', estado.escalaLectura(t.value));
  const v = t.parentElement.querySelector('[data-letra-valor]');
  if (v) v.textContent = t.value;
}

export function manejarCambio(ev, ctx) {
  const t = ev.target;
  if (t.matches('[data-letra]')) estado.ajustar({ pasoLectura: Number(t.value) });
  if (t.matches('[data-hora]')) { notif.cambiarHora(t.value).then(() => ctx.toast('Hora guardada: ' + t.value)).catch((e) => ctx.toast(e.message)); }
  if (t.matches('[data-tema]')) { estado.ajustar({ tema: t.value }); aplicarTema(t.value); }
  if (t.matches('[data-importar]') && t.files[0]) {
    t.files[0].text().then((txt) => { estado.importar(txt); ctx.toast('Importado'); ctx.navegar('#/hoy'); }).catch((e) => ctx.toast('No se pudo importar: ' + e.message));
  }
}

export function aplicarTema(tema) {
  if (tema === 'auto') document.documentElement.removeAttribute('data-tema');
  else document.documentElement.setAttribute('data-tema', tema);
}
