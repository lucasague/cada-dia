// Subrayado de textos en la lectura + panel de subrayados (31/10/2026, pedido de Lucas).
//
// Tres clases de subrayado: 'neutro' (sin más), 'si' (me identifico) y 'no' (no me identifico).
// 'si' y 'no' solo existen en paquetes con `identificacion` (p. ej. el eneagrama): llevan el tipo
// del texto (1-9), que sale solo de la sección del párrafo (`par_secciones` + `identificacion.porSeccion`)
// y se puede corregir en la barra. Con eso el panel "Tipos" cuenta cuántos textos has sentido tuyos
// o ajenos de cada número.
//
// Los subrayados se guardan en estado.js (localStorage + sincronización con el progreso).

import * as estado from './estado.js';
import { I } from './iconos.js';
import * as sync from './sincronizar.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NOMBRE_CLASE = { neutro: 'Subrayado', si: 'Me identifico', no: 'No me identifico' };
const idNuevo = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

/** Tipo (1-9) que le toca por defecto al párrafo i del ítem, o null. */
export function tipoDelParrafo(pack, item, i) {
  const id = pack.identificacion;
  if (!id) return null;
  const sec = (item.par_secciones && item.par_secciones[i]) || item.seccion;
  return (id.porSeccion && id.porSeccion[sec]) || null;
}

/** HTML de un párrafo de prosa con sus marcas. `fmt` convierte texto plano en HTML (escape + notas). */
export function parrafoConMarcas(texto, hs, fmt) {
  const orden = hs.slice().sort((a, b) => a.ini - b.ini);
  let html = '', pos = 0;
  for (const h of orden) {
    if (h.ini < pos || h.fin > texto.length) continue;
    html += fmt(texto.slice(pos, h.ini));
    html += `<mark class="sub sub--${h.clase}" data-h="${esc(h.id)}"${h.tipo && h.clase !== 'neutro' ? ` data-tipo="${h.tipo}"` : ''}>${fmt(texto.slice(h.ini, h.fin))}</mark>`;
    pos = h.fin;
  }
  return html + fmt(texto.slice(pos));
}

// ---------------------------------------------------------------- lectura: selección y barra
export function montarSubrayado(el, ctx, item, fmt) {
  const { pack } = ctx;
  const textoEl = el.querySelector('.lectura__texto');
  if (!textoEl || pack.formato === 'verso') return () => {};
  const ident = pack.identificacion || null;
  const barra = document.createElement('div');
  barra.className = 'sub-barra';
  barra.hidden = true;
  barra.innerHTML = `
    <div class="sub-barra__fila">
      <button type="button" data-sub="neutro" class="sub-boton sub-boton--neutro">Subrayar</button>
      ${ident ? `<button type="button" data-sub="si" class="sub-boton sub-boton--si">Me identifico</button>
      <button type="button" data-sub="no" class="sub-boton sub-boton--no">No me identifico</button>` : ''}
      <button type="button" data-sub-borrar class="sub-boton sub-boton--borrar" hidden>Quitar</button>
      <button type="button" data-sub-cerrar class="sub-boton sub-boton--cerrar" aria-label="Cerrar">×</button>
    </div>
    ${ident ? `<div class="sub-barra__tipos" role="group" aria-label="${esc(ident.nombre)} del texto"><span>${esc(ident.nombre)}</span>${ident.tipos.map((t) => `<button type="button" data-sub-tipo="${t.valor}" title="${esc(t.nombre)}">${t.valor}</button>`).join('')}</div>` : ''}`;
  el.appendChild(barra);

  let modo = null;          // 'nuevo' | 'editar' | null
  let partes = [];          // modo nuevo: [{ p, ini, fin, texto }]
  let editando = null;      // modo editar: subrayado
  let tipoSel = null;
  let ocultar = null;

  const parrafoEl = (i) => textoEl.querySelector(`p[data-p="${i}"]`);
  const repintar = (i) => {
    const p = parrafoEl(i);
    if (!p) return;
    const hs = estado.subrayados(pack.id).filter((h) => h.n === item.n && h.p === i);
    p.innerHTML = parrafoConMarcas(item.parrafos[i], hs, fmt);
  };

  const pintarBarra = () => {
    barra.hidden = modo === null;
    barra.querySelector('[data-sub-borrar]').hidden = modo !== 'editar';
    barra.querySelectorAll('[data-sub]').forEach((b) => b.classList.toggle('activo', modo === 'editar' && editando && editando.clase === b.dataset.sub));
    barra.querySelectorAll('[data-sub-tipo]').forEach((b) => b.classList.toggle('activo', Number(b.dataset.subTipo) === tipoSel));
  };
  const cerrar = () => { modo = null; partes = []; editando = null; pintarBarra(); };

  // Texto crudo de un párrafo <-> posición dentro del <p> renderizado.
  const desplazamiento = (p, nodo, off) => {
    const r = document.createRange();
    r.selectNodeContents(p);
    r.setEnd(nodo, off);
    return r.toString().length;
  };
  const trozos = (rango) => {
    const salida = [];
    textoEl.querySelectorAll('p[data-p]').forEach((p) => {
      if (!rango.intersectsNode(p)) return;
      const i = Number(p.dataset.p);
      const largo = item.parrafos[i].length;
      let ini = p.contains(rango.startContainer) ? desplazamiento(p, rango.startContainer, rango.startOffset) : 0;
      let fin = p.contains(rango.endContainer) ? desplazamiento(p, rango.endContainer, rango.endOffset) : largo;
      const t = item.parrafos[i];
      while (ini < fin && /\s/.test(t[ini])) ini += 1;
      while (fin > ini && /\s/.test(t[fin - 1])) fin -= 1;
      if (fin - ini >= 2) salida.push({ p: i, ini, fin, texto: t.slice(ini, fin) });
    });
    return salida;
  };

  const alCambiarSeleccion = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed && textoEl.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      const ps = trozos(sel.getRangeAt(0));
      if (!ps.length) return;
      clearTimeout(ocultar);
      partes = ps; modo = 'nuevo'; editando = null;
      tipoSel = tipoDelParrafo(pack, item, ps[0].p);
      pintarBarra();
    } else if (modo === 'nuevo') {
      clearTimeout(ocultar);
      ocultar = setTimeout(() => { if (modo === 'nuevo') cerrar(); }, 400);
    }
  };
  document.addEventListener('selectionchange', alCambiarSeleccion);

  // Tocar un subrayado (sin selección) lo abre para cambiarlo o quitarlo; tocar fuera cierra.
  const alTocar = (ev) => {
    if (barra.contains(ev.target)) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const m = ev.target.closest && ev.target.closest('mark[data-h]');
    if (m && textoEl.contains(m)) {
      const h = estado.subrayados(pack.id).find((x) => x.id === m.dataset.h);
      if (h) { modo = 'editar'; editando = h; partes = []; tipoSel = h.tipo || tipoDelParrafo(pack, item, h.p); pintarBarra(); return; }
    }
    if (modo === 'editar') cerrar();
  };
  document.addEventListener('click', alTocar);

  // Que tocar la barra no suelte la selección antes de tiempo.
  barra.addEventListener('pointerdown', (e) => { clearTimeout(ocultar); if (e.target.closest('button')) e.preventDefault(); });
  barra.addEventListener('mousedown', (e) => e.preventDefault());

  barra.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.subCerrar !== undefined) { window.getSelection().removeAllRanges(); cerrar(); return; }
    if (b.dataset.subTipo !== undefined) {
      tipoSel = Number(b.dataset.subTipo);
      if (modo === 'editar' && editando) {
        editando = estado.guardarSubrayado({ ...editando, tipo: tipoSel });
        repintar(editando.p); sync.programarSubidaProgreso();
      }
      pintarBarra();
      return;
    }
    if (b.dataset.subBorrar !== undefined && editando) {
      const i = editando.p;
      estado.borrarSubrayado(editando.id);
      repintar(i); sync.programarSubidaProgreso(); cerrar();
      return;
    }
    const clase = b.dataset.sub;
    if (!clase) return;
    if (clase !== 'neutro' && !tipoSel) { ctx.toast(`Elige antes el ${(ident.nombre || 'tipo').toLowerCase()} del texto (1-9)`); return; }
    if (modo === 'editar' && editando) {
      const i = editando.p;
      estado.guardarSubrayado({ ...editando, clase, tipo: clase === 'neutro' ? (editando.tipo || null) : tipoSel });
      repintar(i);
    } else if (modo === 'nuevo') {
      partes.forEach((x) => {
        estado.guardarSubrayado({ id: idNuevo(), pack: pack.id, n: item.n, p: x.p, ini: x.ini, fin: x.fin, texto: x.texto, clase, tipo: tipoSel || null });
        repintar(x.p);
      });
      window.getSelection().removeAllRanges();
    } else return;
    sync.programarSubidaProgreso();
    ctx.toast(NOMBRE_CLASE[clase] + (clase !== 'neutro' ? ` · tipo ${tipoSel}` : ''));
    cerrar();
  });

  // Venir desde el panel: llevar a ese subrayado.
  let pendiente = null;
  try { pendiente = sessionStorage.getItem('cadadia.irSub'); sessionStorage.removeItem('cadadia.irSub'); } catch { /* sin sessionStorage */ }
  if (pendiente) {
    setTimeout(() => {
      const m = textoEl.querySelector(`mark[data-h="${CSS.escape(pendiente)}"]`);
      if (m) { m.scrollIntoView({ block: 'center', behavior: 'smooth' }); m.classList.add('sub--destello'); setTimeout(() => m.classList.remove('sub--destello'), 2200); }
    }, 250);
  }
  return () => { document.removeEventListener('selectionchange', alCambiarSeleccion); document.removeEventListener('click', alTocar); clearTimeout(ocultar); barra.remove(); };
}

// ---------------------------------------------------------------- panel
let pestana = 'todos';     // todos | neutro | si | no | tipos
let filtroTipo = 0;        // 0 = todos

export function vistaSubrayados(ctx) {
  const { pack } = ctx;
  if (!pack) return { html: '<div class="vacio">Sin contenido.</div>' };
  const ident = pack.identificacion || null;
  const todos = estado.subrayados(pack.id).slice().sort((a, b) => a.n - b.n || a.p - b.p || a.ini - b.ini);
  if (!ident && (pestana === 'si' || pestana === 'no' || pestana === 'tipos')) pestana = 'todos';
  const cuenta = (c) => todos.filter((h) => h.clase === c).length;

  const pestanas = [
    ['todos', 'Todos', todos.length], ['neutro', 'Neutros', cuenta('neutro')],
    ...(ident ? [['si', 'Me identifico', cuenta('si')], ['no', 'No me identifico', cuenta('no')], ['tipos', ident.nombre + 's', null]] : []),
  ];
  const cab = `<div class="sub-pestanas">${pestanas.map(([id, t, n]) => `<button class="sub-pestana ${pestana === id ? 'activo' : ''}" data-sub-tab="${id}">${esc(t)}${n === null ? '' : ` <span>${n}</span>`}</button>`).join('')}</div>`;

  let cuerpo;
  if (pestana === 'tipos' && ident) {
    const filas = ident.tipos.map((t) => {
      const si = todos.filter((h) => h.clase === 'si' && h.tipo === t.valor).length;
      const no = todos.filter((h) => h.clase === 'no' && h.tipo === t.valor).length;
      return { ...t, si, no, neto: si - no };
    });
    const max = Math.max(1, ...filas.map((f) => Math.max(f.si, f.no)));
    const ranking = filas.slice().sort((a, b) => b.si - a.si || b.neto - a.neto).filter((f) => f.si > 0);
    const totalSi = filas.reduce((s, f) => s + f.si, 0), totalNo = filas.reduce((s, f) => s + f.no, 0);
    const resumen = ranking.length
      ? `<div class="tarjeta"><div class="etiqueta">Hasta ahora</div><p class="sub-resumen">Te has sentido más identificado con el <b>tipo ${ranking[0].valor}</b> (${esc(ranking[0].nombre.toLowerCase())}): ${ranking[0].si} ${ranking[0].si === 1 ? 'texto' : 'textos'}.${ranking[1] ? ` Le siguen el ${ranking.slice(1, 3).map((f) => `<b>${f.valor}</b> (${f.si})`).join(' y el ')}.` : ''}</p><p class="nota">${totalSi} textos marcados como tuyos y ${totalNo} como no tuyos. ${totalSi + totalNo < 20 ? 'Son pocos todavía: el resultado se afina a medida que lees.' : 'Es una pista, no un diagnóstico: contrástala con el test y con lo que te dicen quienes te conocen.'}</p></div>`
      : `<div class="tarjeta"><p class="nota">Aún no has marcado ningún texto como «me identifico». Selecciona un párrafo mientras lees y pulsa <b>Me identifico</b> o <b>No me identifico</b>.</p></div>`;
    cuerpo = `${resumen}<div class="sub-tipos">${filas.map((f) => `
      <button class="sub-tipo" data-sub-ver-tipo="${f.valor}">
        <div class="sub-tipo__num">${f.valor}</div>
        <div class="sub-tipo__cuerpo">
          <div class="sub-tipo__nombre">${esc(f.nombre)}</div>
          <div class="sub-tipo__barra"><i class="si" style="width:${(f.si / max) * 100}%"></i></div>
          <div class="sub-tipo__barra"><i class="no" style="width:${(f.no / max) * 100}%"></i></div>
        </div>
        <div class="sub-tipo__cifras"><span class="si">${f.si}</span><span class="no">${f.no}</span></div>
      </button>`).join('')}</div>
      <p class="nota mt"><span class="sub-leyenda si"></span> me identifico · <span class="sub-leyenda no"></span> no me identifico. Pulsa un número para ver sus textos.</p>`;
  } else {
    let lista = pestana === 'todos' ? todos : todos.filter((h) => h.clase === pestana);
    if (ident && filtroTipo) lista = lista.filter((h) => h.tipo === filtroTipo);
    const chips = ident && pestana !== 'neutro' ? `<div class="sub-chips"><button class="${filtroTipo === 0 ? 'activo' : ''}" data-sub-filtro="0">Todos</button>${ident.tipos.map((t) => `<button class="${filtroTipo === t.valor ? 'activo' : ''}" data-sub-filtro="${t.valor}" title="${esc(t.nombre)}">${t.valor}</button>`).join('')}</div>` : '';
    cuerpo = chips + (lista.length
      ? `<div class="sub-lista">${lista.map((h) => {
        const it = pack.porN.get(h.n);
        return `<button class="sub-tarjeta sub-tarjeta--${h.clase}" data-ir="#/leer/${h.n}" data-sub-id="${esc(h.id)}">
          <blockquote>${esc(h.texto)}</blockquote>
          <div class="sub-tarjeta__meta"><span class="sub-etiqueta sub-etiqueta--${h.clase}">${NOMBRE_CLASE[h.clase]}${h.tipo && h.clase !== 'neutro' ? ` · tipo ${h.tipo}` : ''}</span><span>${it ? esc(it.titulo) : ''} · ${esc(pack.unidad || 'ítem')} ${h.n}</span></div>
        </button>`;
      }).join('')}</div>`
      : `<div class="vacio">${todos.length ? 'Nada con ese filtro.' : 'Todavía no has subrayado nada. En la lectura, selecciona un texto con el dedo y aparecerán las opciones abajo.'}</div>`);
  }

  const html = `<div class="vista"><div class="sub-cab">${I.subrayar}<h1>Subrayados</h1></div>${cab}${cuerpo}</div>`;
  const montar = (el) => {
    const repetir = () => ctx.navegar('#/subrayados', true);
    el.querySelectorAll('[data-sub-tab]').forEach((b) => { b.onclick = () => { pestana = b.dataset.subTab; repetir(); }; });
    el.querySelectorAll('[data-sub-filtro]').forEach((b) => { b.onclick = () => { filtroTipo = Number(b.dataset.subFiltro); repetir(); }; });
    el.querySelectorAll('[data-sub-ver-tipo]').forEach((b) => { b.onclick = () => { pestana = 'si'; filtroTipo = Number(b.dataset.subVerTipo); repetir(); }; });
    el.querySelectorAll('[data-sub-id]').forEach((b) => b.addEventListener('click', () => { try { sessionStorage.setItem('cadadia.irSub', b.dataset.subId); } catch { /* nada */ } }));
  };
  return { html, montar };
}
