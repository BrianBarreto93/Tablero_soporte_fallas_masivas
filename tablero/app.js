/* Tablero Soporte y Fallas masivas.
   datos.js = cubo de CONTEOS (filas = combinación de dimensiones + medidas sumables). Todo indicador se calcula
   sumando las filas que pasan los filtros. comentarios.js (voz del cliente) se carga después de pintar. */
'use strict';
(() => {
const D = window.DATOS;
if (!D) { document.getElementById('stage').innerHTML = '<p class="vacio">No se encontró datos.js. Corre el ETL (python -m etl.construir).</p>'; return; }

// ------------------------------------------------------------------ índices
const DIMS = D.dims, ND = DIMS.length, V = D.valores;
const DI = Object.fromEntries(DIMS.map((d, i) => [d, i]));
const MI = Object.fromEntries(D.medidas.map((m, i) => [m, ND + i]));
const NMIN = D.n_minimo, PERIODOS = V.periodo, EST = V.estudio;
const CE = {'Soporte': 'var(--s-sop)', 'Falla masiva': 'var(--s-fm)'};
const MULTI = [['region', 'Región'], ['red', 'Red'], ['marcacion', 'Marcación'], ['aliado', 'Aliado'], ['operacion', 'Operación']];
const agrupar = l => { const m = new Map(); for (const [r, t, c] of l) { if (!m.has(r)) m.set(r, []); m.get(r).push([t, c]); } return m; };
const TD = agrupar(D.temas_dificil), TM = agrupar(D.temas_mejora);

// ------------------------------------------------------------------ formato es-CO
const nf0 = new Intl.NumberFormat('es-CO', {maximumFractionDigits: 0});
const nf1 = new Intl.NumberFormat('es-CO', {minimumFractionDigits: 1, maximumFractionDigits: 1});
const f0 = x => nf0.format(x).replace('-', '−'), f1 = x => nf1.format(x).replace('-', '−');
const fpp = x => (x > 0 ? '+' : '') + f1(x);
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesC = p => `${MES[+p.slice(4) - 1]}-${p.slice(2, 4)}`, mesL = p => `${MESL[+p.slice(4) - 1]} ${p.slice(0, 4)}`;
const semC = s => { const [, m, d] = s.split('-'); return `${+d} ${MES[+m - 1]}`; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ICO = {
  resumen: '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z"/>',
  facilidad: '<path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 12l5-3"/><circle cx="12" cy="12" r="1.2"/>',
  resolucion: '<path d="M4 12.5l5 5L20 6.5"/>',
  asesor: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><path d="M4 15a2 2 0 0 0 2 2h1v-5H6a2 2 0 0 0-2 2zM20 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2z"/><path d="M17 17c0 2-2 3-5 3"/>',
  voz: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z"/>',
  calidad: '<path d="M12 3l8 3v6c0 4.4-3.4 8-8 9-4.6-1-8-4.6-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', izq: '<path d="M15 5l-7 7 7 7"/>', der: '<path d="M9 5l7 7-7 7"/>',
};
const svgI = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>`;

// ------------------------------------------------------------------ indicadores
const prop = (x, b) => b ? {v: x / b * 100, n: b, ic: 196 * Math.sqrt((x / b) * (1 - x / b) / b)} : null;
const IND = {
  nps: {nombre: 'NPS', corto: 'NPS', min: -100, max: 100,
    def: 'Net Promoter Score: % promotores (9–10) − % detractores (0–6) en la recomendación (Q2). Base: todas las encuestas.',
    calc: a => { if (!a.n) return null; const p = a.prom / a.n, d = a.det / a.n; return {v: (p - d) * 100, n: a.n, ic: 196 * Math.sqrt((p + d - (p - d) ** 2) / a.n)}; }},
  ces: {nombre: 'CES · facilidad', corto: 'CES', min: 0, max: 100,
    def: 'Facilidad para recibir solución: (Fácil + Muy fácil) / respuestas válidas de Q6 «¿Qué tan fácil fue contactarse con un asesor para reportar la falla?». Más alto = mejor.',
    calc: a => prop(a.q6_4 + a.q6_5, a.q6_1 + a.q6_2 + a.q6_3 + a.q6_4 + a.q6_5)},
  fun: {nombre: 'Servicio funcionando', corto: 'Funcionando', min: 0, max: 100,
    def: '% que responde «Sí» a Q8 «¿Tu servicio se encuentra funcionando correctamente?». Base: Sí + No (las encuestas sin terminar no cuentan).',
    calc: a => prop(a.q8_si, a.q8_si + a.q8_no)},
  ase: {nombre: 'Desempeño del asesor', corto: 'Asesor', min: 0, max: 100,
    def: '% de calificaciones 4–5 (escala 1–5) en los cuatro atributos del asesor (Q9: profesionalismo, amabilidad, claridad y tiempo). n = encuestas que lo calificaron.',
    calc: a => { const b = a.q9_1_val + a.q9_2_val + a.q9_3_val + a.q9_4_val, n = Math.max(a.q9_1_val, a.q9_2_val, a.q9_3_val, a.q9_4_val);
      if (!b) return null; const p = (a.q9_1_top2 + a.q9_2_top2 + a.q9_3_top2 + a.q9_4_top2) / b; return {v: p * 100, n, ic: 196 * Math.sqrt(p * (1 - p) / n)}; }},
};
const KS = ['nps', 'ces', 'fun', 'ase'];
const fmt = (k, r) => r == null ? '—' : (k === 'nps' ? f1(r.v) : f1(r.v) + ' %');
const fmtGrande = (k, r) => r == null ? '—' : `${f1(r.v)}<small>${k === 'nps' ? 'pts' : '%'}</small>`;

// ------------------------------------------------------------------ estado + URL
const TABS = [['resumen', 'Resumen'], ['facilidad', 'Facilidad'], ['resolucion', 'Resolución'], ['asesor', 'Asesor'], ['voz', 'Voces'], ['calidad', 'Calidad']];
const st = {periodo: PERIODOS.length - 1, estudio: null, tab: 'resumen', evo: 'nps', modo: PERIODOS.length > 1 ? 'mes' : 'semana',
  ...Object.fromEntries(MULTI.map(([k]) => [k, new Set()]))};
function leerHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.has('periodo')) { const i = PERIODOS.indexOf(h.get('periodo')); if (i >= 0) st.periodo = i; }
  st.estudio = h.has('estudio') && EST.includes(h.get('estudio')) ? EST.indexOf(h.get('estudio')) : null;
  if (h.has('tab') && TABS.some(t => t[0] === h.get('tab'))) st.tab = h.get('tab');
  for (const [k] of MULTI) st[k] = new Set((h.get(k) || '').split('|').filter(Boolean).map(v => V[k].indexOf(v)).filter(i => i >= 0));
}
function escribirHash() {
  const h = new URLSearchParams();
  h.set('periodo', PERIODOS[st.periodo]);
  if (st.estudio != null) h.set('estudio', EST[st.estudio]);
  for (const [k] of MULTI) if (st[k].size) h.set(k, [...st[k]].map(i => V[k][i]).join('|'));
  if (st.tab !== 'resumen') h.set('tab', st.tab);
  history.replaceState(null, '', '#' + h);
}

// ------------------------------------------------------------------ motor
function pasa(r, o = {}) {
  const per = 'periodo' in o ? o.periodo : st.periodo, est = 'estudio' in o ? o.estudio : st.estudio;
  if (per != null && r[0] !== per) return false;
  if (est != null && r[DI.estudio] !== est) return false;
  for (const [k] of MULTI) if (k !== o.ignorar && st[k].size && !st[k].has(r[DI[k]])) return false;
  return true;
}
const filas = o => { const out = []; D.cubo.forEach((r, i) => { if (pasa(r, o)) out.push(i); }); return out; };
function sumar(idx) {
  const a = Object.fromEntries(D.medidas.map(m => [m, 0]));
  for (const i of idx) { const r = D.cubo[i]; for (const m of D.medidas) a[m] += r[MI[m]]; }
  return a;
}
function porDim(idx, dim) {
  const g = new Map();
  for (const i of idx) { const v = D.cubo[i][DI[dim]]; if (!g.has(v)) g.set(v, []); g.get(v).push(i); }
  return [...g].map(([v, ix]) => ({v, nombre: V[dim][v], idx: ix, a: sumar(ix)}));
}
const ests = () => st.estudio == null ? EST.map((_, i) => i) : [st.estudio];
const alcance = () => st.estudio == null ? 'Soporte + Falla masiva' : EST[st.estudio];
function serie(k, modo, e) {
  const idx = filas({periodo: modo === 'mes' ? null : st.periodo, estudio: e});
  return porDim(idx, modo === 'mes' ? 'periodo' : 'semana')
    .map(g => ({x: g.v, et: modo === 'mes' ? mesC(V.periodo[g.v]) : semC(V.semana[g.v]), r: IND[k].calc(g.a)}))
    .filter(p => p.r).sort((a, b) => a.x - b.x);
}

// ------------------------------------------------------------------ comentarios (carga diferida)
let C = null;
function cargarComentarios() {
  if (C || document.getElementById('js-com')) return;
  const s = document.createElement('script'); s.src = 'comentarios.js'; s.id = 'js-com';
  s.onload = () => {
    const cm = window.COMENTARIOS, ix = Object.fromEntries(cm.campos.map((c, i) => [c, i]));
    C = cm.filas.map(f => ({r: f, grupo: f[ix.grupo], q8: f[ix.q8], q6: f[ix.q6], q2: f[ix.q2], q9: f[ix.q9], preg: D.cod_preguntas[f[ix.pregunta]], texto: f[ix.texto]}));
    delete window.COMENTARIOS;
    pintarTab(); if (cajon.dataset.k) abrirCajon(cajon.dataset.k, false);
  };
  s.onerror = () => { C = []; pintarTab(); };
  document.body.appendChild(s);
}
// Lentes: qué comentarios ilustran cada lado de cada indicador
const LENTES = {
  det: {t: 'Detractores', malo: true, pred: v => v.grupo === 0, preg: ['Q3', 'Q13']},
  pro: {t: 'Promotores', pred: v => v.grupo === 2, preg: ['Q4', 'Q13']},
  dif: {t: 'Difícil contactar', malo: true, pred: v => v.q6 === 1 || v.q6 === 2, preg: ['Q7', 'Q3']},
  fac: {t: 'Fácil contactar', pred: v => v.q6 >= 4, preg: ['Q4', 'Q13']},
  nof: {t: 'No funciona', malo: true, pred: v => v.q8 === 0, preg: ['Q3', 'Q13']},
  sif: {t: 'Sí funciona', pred: v => v.q8 === 1, preg: ['Q4', 'Q13']},
  amal: {t: 'Asesor mal evaluado', malo: true, pred: v => v.q9 > 0 && v.q9 <= 2.5, preg: ['Q10', 'Q3']},
  abien: {t: 'Asesor bien evaluado', pred: v => v.q9 >= 4.5, preg: ['Q10', 'Q4']},
};
const PAR = {nps: ['det', 'pro'], ces: ['dif', 'fac'], fun: ['nof', 'sif'], ase: ['amal', 'abien']};
const GENERICO = /^(n\/?a|ninguna?|ninguno|nada|no|si|sí|ok|bien|bueno|buena|excelente|todo bien|gracias|mal[oa]?|regular|\.+|-+)\.?$/i;
// Ejemplos representativos: filtros globales + lente, sin genéricos, largo legible, variados por marcación
function ejemplos(lente, k = 12, q = '') {
  if (!C) return null;
  const L = lente ? LENTES[lente] : null;
  const cand = C.filter(v => (!L || (L.pred(v) && L.preg.includes(v.preg))) && pasa(v.r) && v.texto.length >= 25 && !GENERICO.test(v.texto.trim()) && (!q || norm(v.texto).includes(q)));
  const total = cand.length;
  cand.sort((a, b) => Math.abs(a.texto.length - 150) - Math.abs(b.texto.length - 150));
  const porM = new Map(); for (const v of cand) { const m = v.r[DI.marcacion]; if (!porM.has(m)) porM.set(m, []); porM.get(m).push(v); }
  const colas = [...porM.values()].sort((a, b) => b.length - a.length), out = [], vistos = new Set();
  for (let i = 0; out.length < k && colas.some(c => c.length > i); i++)
    for (const c of colas) { const v = c[i]; if (v && !vistos.has(v.texto) && out.length < k) { vistos.add(v.texto); out.push(v); } }
  return {total, items: out};
}
const colNota = n => n == null || n < 0 ? 'var(--ink-3)' : n <= 6 ? 'var(--d-2)' : n <= 8 ? 'var(--ink-3)' : 'var(--d2)';
function tarjeta(v, marcar = '') {
  let t = esc(v.texto);
  if (marcar) t = t.replace(new RegExp(`(${esc(marcar).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
  const e = V.estudio[v.r[DI.estudio]];
  return `<article class="voz" tabindex="0"><q>${t}</q><div class="m"><span class="nota-nps" style="background:${colNota(v.q2)}" ${tipAttr(`Recomendación: ${v.q2 < 0 ? '—' : v.q2 + ' de 10'}`)}>${v.q2 < 0 ? '–' : v.q2}</span>
    <span><i class="punto" style="background:${CE[e]}"></i> ${esc(e)} · ${mesC(PERIODOS[v.r[0]])}</span><span class="mc" title="${esc(V.marcacion[v.r[DI.marcacion]])}">${esc(V.marcacion[v.r[DI.marcacion]])}</span></div></article>`;
}
const carEst = {};
function carrusel(id, lentes) {
  const e = carEst[id] ||= {lente: lentes[0]};
  const ej = ejemplos(e.lente);
  const cards = ej == null ? Array(5).fill('<div class="esqueleto" aria-hidden="true"></div>').join('') :
    ej.items.length ? ej.items.map(v => tarjeta(v)).join('') : '<p class="vacio">Sin comentarios con estos filtros</p>';
  return `<section class="panel" data-car="${id}"><header><h2>Lo que dicen los clientes <span class="nota" style="font-weight:600;margin-left:6px" ${tipAttr('Ejemplos variados por marcación, con los filtros actuales. Clic en una tarjeta para leerla completa. Datos personales tapados.')}>${ej ? `${f0(ej.total)} comentarios · ${ej.items.length} ejemplos` : 'cargando…'}</span></h2>
      <div class="seg" role="group" aria-label="Tipo de comentario">${lentes.map(l => `<button type="button" data-lente="${l}" aria-pressed="${e.lente === l}">${LENTES[l].t}</button>`).join('')}</div>
</header>
    <div class="voces"><button type="button" class="flecha izq" aria-label="Anteriores">${svgI('izq')}</button><div class="riel-v">${cards}</div><button type="button" class="flecha der" aria-label="Siguientes">${svgI('der')}</button></div></section>`;
}
function montarCarrusel(raiz) {
  raiz.querySelectorAll('[data-car]').forEach(p => {
    p.querySelectorAll('[data-lente]').forEach(b => b.onclick = () => { carEst[p.dataset.car].lente = b.dataset.lente; pintarTab(); });
    const riel = p.querySelector('.riel-v');
    p.querySelector('.izq').onclick = () => riel.scrollBy({left: -riel.clientWidth * .9, behavior: 'smooth'});
    p.querySelector('.der').onclick = () => riel.scrollBy({left: riel.clientWidth * .9, behavior: 'smooth'});
  });
  raiz.querySelectorAll('.voz').forEach(c => { c.onclick = () => c.classList.toggle('abierta'); c.onkeydown = e => { if (e.key === 'Enter') c.classList.toggle('abierta'); }; });
}

// ------------------------------------------------------------------ tooltip
const tip = document.getElementById('tip');
function verTip(html, x, y) {
  tip.innerHTML = html; tip.classList.add('ver');
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(innerWidth - w - 8, Math.max(8, x + 14)) + 'px';
  tip.style.top = (y + h + 18 > innerHeight ? y - h - 12 : y + 14) + 'px';
}
document.addEventListener('mousemove', e => { const t = e.target.closest?.('[data-tip]'); t ? verTip(t.dataset.tip, e.clientX, e.clientY) : tip.classList.remove('ver'); });
document.addEventListener('focusin', e => { const t = e.target.closest?.('[data-tip]'); if (t) { const b = t.getBoundingClientRect(); verTip(t.dataset.tip, b.left, b.bottom); } });
document.addEventListener('focusout', () => tip.classList.remove('ver'));
const tipAttr = html => `data-tip="${esc(html)}"`;
const tipInd = (k, r, extra = '') => r == null ? 'Sin respuestas válidas' :
  `<div class="t">${IND[k].nombre}: ${fmt(k, r)}</div>n = ${f0(r.n)} · IC 95 % ±${f1(r.ic)} ${k === 'nps' ? 'pts' : 'pp'}${r.n < NMIN ? '<br><b>Muestra baja</b>: lectura indicativa' : ''}${extra}`;
const bajo = r => r && r.n < NMIN ? ' <span class="bajo">muestra baja</span>' : '';

// ------------------------------------------------------------------ barra superior
const ctrl = document.getElementById('ctrl'), barF = document.getElementById('filtros');
function pintarCtrl() {
  ctrl.innerHTML = `
    <label class="sr" for="f-per">Periodo</label>
    <select class="sel" id="f-per">${PERIODOS.map((p, i) => `<option value="${i}"${i === st.periodo ? ' selected' : ''}>${mesL(p)}</option>`).join('')}</select>
    <div class="seg" role="group" aria-label="Estudio" id="f-est"><button type="button" data-v="" aria-pressed="${st.estudio == null}">Todos</button>${EST.map((e, i) => `<button type="button" data-v="${i}" aria-pressed="${st.estudio === i}"><i style="background:${CE[e]}"></i>${e}</button>`).join('')}</div>`;
  ctrl.querySelector('#f-per').onchange = e => { st.periodo = +e.target.value; refrescar(); };
  ctrl.querySelectorAll('#f-est button').forEach(b => b.onclick = () => { st.estudio = b.dataset.v === '' ? null : +b.dataset.v; refrescar(); });
}
function pintarFiltros() {
  barF.innerHTML = MULTI.map(([k, et]) => {
    const n = st[k].size, txt = n === 0 ? et : n === 1 ? `${et}: <b>${esc(V[k][[...st[k]][0]])}</b>` : `${et}: <b>${n}</b>`;
    return `<div class="pill-f" data-k="${k}"><button type="button" class="${n ? 'activo' : ''}" aria-haspopup="true" aria-expanded="false"><span>${n ? '' : '+ '}${txt}</span></button><div class="pop" hidden role="group" aria-label="${et}"></div></div>`;
  }).join('') + `<button type="button" class="limpiar" id="f-limpiar" ${MULTI.some(([k]) => st[k].size) || st.estudio != null ? '' : 'hidden'}>Limpiar filtros</button>`;
  barF.querySelectorAll('.pill-f').forEach(montarPop);
  barF.querySelector('#f-limpiar').onclick = () => { MULTI.forEach(([k]) => st[k].clear()); st.estudio = null; refrescar(); };
}
function montarPop(caja) {
  const k = caja.dataset.k, btn = caja.querySelector('button'), pop = caja.querySelector('.pop');
  const abrir = si => { pop.hidden = !si; btn.setAttribute('aria-expanded', si); if (si) { pintar(); pop.querySelector('.buscar')?.focus(); } };
  btn.onclick = e => { e.stopPropagation(); document.querySelectorAll('.pop:not([hidden])').forEach(p => { if (p !== pop) p.hidden = true; }); abrir(pop.hidden); };
  caja.addEventListener('keydown', e => { if (e.key === 'Escape') { abrir(false); btn.focus(); } });
  function pintar() {
    const cnt = new Map(porDim(filas({ignorar: k}), k).map(g => [g.v, g.a.n]));
    const ops = V[k].map((nombre, i) => ({i, nombre, n: cnt.get(i) || 0})).filter(o => o.n || st[k].has(o.i));
    pop.innerHTML = (ops.length > 8 ? `<input class="buscar" type="search" placeholder="Buscar…" aria-label="Buscar">` : '') +
      ops.map(o => `<label class="op"><input type="checkbox" value="${o.i}"${st[k].has(o.i) ? ' checked' : ''}><span>${esc(o.nombre)}</span><small>${f0(o.n)}</small></label>`).join('');
    pop.querySelectorAll('input[type=checkbox]').forEach(c => c.onchange = () => { c.checked ? st[k].add(+c.value) : st[k].delete(+c.value); refrescar({mantener: k}); });
    const b = pop.querySelector('.buscar'); if (b) b.oninput = () => { const q = norm(b.value); pop.querySelectorAll('.op').forEach(o => o.hidden = !norm(o.textContent).includes(q)); };
  }
}
document.addEventListener('click', e => { if (!e.target.closest('.pill-f')) document.querySelectorAll('.pop:not([hidden])').forEach(p => { p.hidden = true; p.previousElementSibling.setAttribute('aria-expanded', false); }); });
function alternar(dim, i) { if (!MULTI.some(([k]) => k === dim)) return; st[dim].has(i) ? st[dim].delete(i) : st[dim].add(i); refrescar(); }

// ------------------------------------------------------------------ navegación
const nav = document.getElementById('nav');
function pintarNav() {
  const av = (D.periodos[PERIODOS[st.periodo]]?.calidad || []).filter(c => c.nivel !== 'ok').length;
  nav.innerHTML = TABS.map(([k, t]) => `<button role="tab" id="t-${k}" aria-controls="p-${k}" aria-selected="${st.tab === k}" tabindex="${st.tab === k ? 0 : -1}">${svgI(k)}${t}${k === 'calidad' && av ? `<span class="badge" aria-label="${av} avisos">${av}</span>` : ''}</button>`).join('');
  nav.querySelectorAll('[role=tab]').forEach((b, i, all) => {
    b.onclick = () => irA(b.id.slice(2));
    b.onkeydown = e => {
      const j = ['ArrowDown', 'ArrowRight'].includes(e.key) ? (i + 1) % all.length : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? (i - 1 + all.length) % all.length : -1;
      if (j >= 0) { e.preventDefault(); irA(TABS[j][0]); nav.querySelector('#t-' + TABS[j][0]).focus(); }
    };
  });
  TABS.forEach(([k]) => document.getElementById('p-' + k).hidden = k !== st.tab);
}
function irA(k) { st.tab = k; pintarNav(); pintarTab(); escribirHash(); const t = document.querySelector('.top'); if (scrollY > t.offsetTop) scrollTo({top: t.offsetTop}); }

// ------------------------------------------------------------------ piezas
function delta(k, act, ant, etq) {
  if (!act) return '';
  if (!ant) return `<span class="nota">sin mes anterior</span>`;
  const d = act.v - ant.v, c = Math.abs(d) < .05 ? 'igual' : d > 0 ? 'mejora' : 'empeora';
  return `<span class="delta ${c}" ${tipAttr(`${etq}: ${fmt(k, ant)} · n ${f0(ant.n)}`)}>${c === 'igual' ? '■' : d > 0 ? '▲' : '▼'} ${fpp(d)} ${k === 'nps' ? 'pts' : 'pp'}<span class="sr"> ${c === 'mejora' ? 'mejora' : c === 'empeora' ? 'empeora' : 'igual'}</span></span><span class="nota">vs ${etq}</span>`;
}
function spark(k) {
  const lines = ests().map(e => ({e, pts: serie(k, 'mes', e)})).filter(s => s.pts.length > 1);
  if (!lines.length) return '';
  const W = 200, H = 34, all = lines.flatMap(s => s.pts.map(p => p.r.v)), lo = Math.min(...all), hi = Math.max(...all), rg = hi - lo || 1, n = PERIODOS.length;
  const X = i => 3 + (W - 6) * i / Math.max(1, n - 1);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><line x1="${X(st.periodo)}" x2="${X(st.periodo)}" y1="0" y2="${H}" stroke="var(--eje)" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>${lines.map(s =>
    `<polyline fill="none" stroke="${CE[EST[s.e]]}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" points="${s.pts.map(p => X(p.x) + ',' + (3 + (H - 6) * (1 - (p.r.v - lo) / rg))).join(' ')}"/>`).join('')}</svg>`;
}
function pesa(k, rs) {
  const {min, max} = IND[k], X = v => (v - min) / (max - min) * 100, ok = rs.filter(Boolean);
  let s = `<div class="pesa" role="img" aria-label="${IND[k].nombre}: ${EST.map((e, i) => e + ' ' + fmt(k, rs[i])).join(', ')}"><span class="riel"></span>`;
  if (min < 0) s += `<span class="cero" style="left:${X(0)}%"></span>`;
  if (ok.length === 2) s += `<span class="une" style="left:${Math.min(X(rs[0].v), X(rs[1].v))}%;width:${Math.abs(X(rs[0].v) - X(rs[1].v))}%"></span>`;
  rs.forEach((r, i) => { if (r) s += `<span class="pt${r.n < NMIN ? ' hueco' : ''}" style="left:${X(r.v)}%;background:${CE[EST[i]]};${r.n < NMIN ? 'border-color:' + CE[EST[i]] : ''}" ${tipAttr(tipInd(k, r, `<br>${EST[i]}`))}></span>`; });
  return s + '</div>';
}
// Gráfico de líneas: se dibuja después de insertar el HTML, con el tamaño real del contenedor
const lineasPH = (k, modo, id) => `<div class="chart" data-lineas="${k}" data-modo="${modo}" id="${id}" role="img" aria-label="${IND[k].nombre} por ${modo === 'mes' ? 'mes' : 'semana'}"></div>`;
const tablaPH = id => `<details class="equiv"><summary>Tabla</summary><div class="tw" data-tabla="${id}"></div></details>`;
function dibujarLineas(raiz) {
  raiz.querySelectorAll('[data-lineas]').forEach(el => {
    const k = el.dataset.lineas, modo = el.dataset.modo, W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return;
    const S = ests().map(e => ({e: EST[e], pts: serie(k, modo, e)})).filter(s => s.pts.length);
    const xs = [...new Set(S.flatMap(s => s.pts.map(p => p.x)))].sort((a, b) => a - b);
    const tabla = raiz.querySelector(`[data-tabla="${el.id}"]`);
    if (!xs.length) { el.innerHTML = '<p class="vacio">Sin datos con estos filtros</p>'; return; }
    const etq = x => S.flatMap(s => s.pts).find(p => p.x === x).et;
    const L = 38, R = 52, T = 14, B = 24, vals = S.flatMap(s => s.pts.map(p => p.r.v));
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = Math.max(4, (hi - lo) * .15);
    lo = Math.max(IND[k].min, Math.floor((lo - pad) / 10) * 10); hi = Math.min(IND[k].max, Math.ceil((hi + pad) / 10) * 10);
    const X = i => xs.length === 1 ? (L + W - R) / 2 : L + (W - L - R) * i / (xs.length - 1), Y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    const paso = hi - lo > 60 ? 20 : 10, cada = Math.max(1, Math.ceil(xs.length / Math.max(2, Math.floor((W - L - R) / 52))));
    let s = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">`;
    if (modo === 'mes' && xs.includes(st.periodo)) s += `<rect x="${X(xs.indexOf(st.periodo)) - 16}" y="${T - 6}" width="32" height="${H - T - B + 12}" rx="10" fill="var(--panel-2)"/>`;
    for (let v = Math.ceil(lo / paso) * paso; v <= hi; v += paso) s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${f0(v)}</text>`;
    if (lo < 0 && hi > 0) s += `<line class="eje" x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}"/>`;
    xs.forEach((x, i) => { if (i % cada === 0 || i === xs.length - 1) s += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle"${modo === 'mes' && x === st.periodo ? ' style="fill:var(--ink);font-weight:800"' : ''}>${esc(etq(x))}</text>`; });
    for (const {e, pts} of S) {
      const c = CE[e], pos = pts.map(p => [X(xs.indexOf(p.x)), Y(p.r.v), p]);
      s += `<polyline fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" points="${pos.map(q => q[0] + ',' + q[1]).join(' ')}"/>`;
      s += pos.map(([x, y, p]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="${p.r.n < NMIN ? 'var(--panel)' : c}" stroke="${p.r.n < NMIN ? c : 'var(--panel)'}" stroke-width="2"/>`).join('');
      const u = pos[pos.length - 1]; s += `<text class="val" x="${u[0] + 8}" y="${u[1] + 4}">${fmt(k, u[2].r)}</text>`;
    }
    xs.forEach((x, i) => {
      const x0 = i ? (X(i - 1) + X(i)) / 2 : L, x1 = i < xs.length - 1 ? (X(i) + X(i + 1)) / 2 : W - R;
      const t = S.map(({e, pts}) => { const p = pts.find(p => p.x === x); return p ? `<i style="background:${CE[e]}"></i>${e}: <b>${fmt(k, p.r)}</b> · n ${f0(p.r.n)}${p.r.n < NMIN ? ' (muestra baja)' : ''}` : ''; }).filter(Boolean).join('<br>');
      s += `<rect class="hit" x="${x0}" y="${T}" width="${x1 - x0}" height="${H - T - B}" ${tipAttr(`<div class="t">${esc(etq(x))}</div>${t}`)}/>`;
    });
    el.innerHTML = s + '</svg>';
    if (tabla) tabla.innerHTML = `<table class="rk"><thead><tr><th>${modo === 'mes' ? 'Mes' : 'Semana'}</th>${S.map(s => `<th class="num">${s.e}</th><th class="num">n</th>`).join('')}</tr></thead><tbody>${xs.map(x => `<tr><td>${esc(etq(x))}</td>${S.map(s => { const p = s.pts.find(p => p.x === x); return `<td class="num">${p ? fmt(k, p.r) : '—'}</td><td class="num">${p ? f0(p.r.n) : '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  });
}
const Q6C = ['var(--d-2)', 'var(--d-1)', 'var(--d0)', 'var(--d1)', 'var(--d2)'];
function divergente(grupos) {
  const P = grupos.map(g => { const t = [1, 2, 3, 4, 5].map(i => g.a['q6_' + i]), n = t.reduce((x, y) => x + y, 0); return {...g, t, n, p: t.map(x => n ? x / n * 100 : 0)}; }).filter(g => g.n);
  if (!P.length) return '<p class="vacio">Sin datos</p>';
  const izq = Math.max(...P.map(g => g.p[0] + g.p[1] + g.p[2] / 2)), der = Math.max(...P.map(g => g.p[4] + g.p[3] + g.p[2] / 2)), tot = izq + der;
  return `<div class="leyenda">${D.q6.map((q, i) => `<span><i style="background:${Q6C[i]}"></i>${q}</span>`).join('')}</div>` + P.map(g => {
    const off = (izq - (g.p[0] + g.p[1] + g.p[2] / 2)) / tot * 100;
    return `<div class="apil"><div class="et">${esc(g.nombre)}<small>n ${f0(g.n)}</small></div><div class="tira" style="padding-left:${off}%" role="img" aria-label="${esc(g.nombre)}: ${D.q6.map((q, i) => q + ' ' + f1(g.p[i]) + ' %').join(', ')}">${g.p.map((p, i) => `<span class="${i === 2 ? 'osc' : ''}" style="width:${p / tot * 100}%;background:${Q6C[i]}" ${tipAttr(`<div class="t">${esc(g.nombre)} · ${D.q6[i]}</div>${f1(p)} % (${f0(g.t[i])} de ${f0(g.n)})`)}>${p / tot * 100 > 7 ? f0(p) + '%' : ''}</span>`).join('')}<span class="centro" style="left:${izq / tot * 100}%"></span></div><div class="fin">${fmt('ces', IND.ces.calc(g.a))}<small>CES</small></div></div>`;
  }).join('');
}
function apilada(grupos, partes, k) {
  return `<div class="leyenda">${partes.map(p => `<span><i style="background:${p.c}"></i>${p.t}</span>`).join('')}</div>` + grupos.filter(g => g.a.n).map(g => {
    const c = partes.map(p => p.v(g.a)), n = c.reduce((x, y) => x + y, 0) || 1;
    return `<div class="apil"><div class="et">${esc(g.nombre)}<small>n ${f0(n)}</small></div><div class="tira">${c.map((x, i) => `<span class="${partes[i].osc ? 'osc' : ''}" style="width:${x / n * 100}%;background:${partes[i].c}" ${tipAttr(`<div class="t">${esc(g.nombre)} · ${partes[i].t}</div>${f1(x / n * 100)} % (${f0(x)})`)}>${x / n > .07 ? f0(x / n * 100) + '%' : ''}</span>`).join('')}</div><div class="fin">${fmt(k, IND[k].calc(g.a))}<small>${IND[k].corto}</small></div></div>`;
  }).join('');
}
const PARTES_NPS = [{t: 'Detractores 0–6', c: 'var(--d-2)', v: a => a.det}, {t: 'Pasivos 7–8', c: 'var(--d0)', osc: true, v: a => a.n - a.det - a.prom}, {t: 'Promotores 9–10', c: 'var(--d2)', v: a => a.prom}];
const PARTES_FUN = [{t: 'No funciona', c: 'var(--d-2)', v: a => a.q8_no}, {t: 'Funciona', c: 'var(--d2)', v: a => a.q8_si}];
function barras(items, base, color) {
  if (!items.length || !base) return '<p class="vacio">Sin datos</p>';
  const max = Math.max(...items.map(x => x.c));
  return `<div class="barras">${items.map(x => `<div class="barra" ${tipAttr(`<div class="t">${esc(x.nombre)}</div>${f0(x.c)} de ${f0(base)} (${f1(x.c / base * 100)} %)`)}><span class="et">${esc(x.nombre)}</span><span class="p"><b style="width:${x.c / max * 100}%;background:${color(x)}"></b></span><span class="num">${f1(x.c / base * 100)} %<small>${f0(x.c)}</small></span></div>`).join('')}</div>`;
}
function temas(mapa, nombres, idx) {
  const c = new Map(); for (const i of idx) for (const [t, n] of mapa.get(i) || []) c.set(t, (c.get(t) || 0) + n);
  const o = [...c].map(([t, n]) => ({nombre: nombres[t], c: n})).sort((a, b) => b.c - a.c);
  if (o.length <= 9) return o;
  const r = o.slice(8); return [...o.slice(0, 8), {nombre: `Otros ${r.length} temas`, c: r.reduce((x, y) => x + y.c, 0)}];
}
const DIM_RK = [['marcacion', 'Marcación'], ['aliado', 'Aliado'], ['region', 'Región'], ['red', 'Red'], ['operacion', 'Operación'], ['estrato', 'Estrato']];
const rkEst = {};
function ranking(id, k, dims = DIM_RK, tope = 10) {
  const e = rkEst[id] ||= {dim: dims[0][0], orden: 'n', todos: false};
  const idx = filas(), tot = IND[k].calc(sumar(idx));
  const g = porDim(idx, e.dim).map(x => ({...x, r: IND[k].calc(x.a)})).filter(x => x.r);
  const val = x => x.r.n < NMIN ? (e.orden === 'peor' ? 1e9 : -1e9) : x.r.v;
  g.sort(e.orden === 'n' ? (a, b) => b.r.n - a.r.n : e.orden === 'peor' ? (a, b) => val(a) - val(b) : (a, b) => val(b) - val(a));
  const vis = e.todos ? g : g.slice(0, tope), {min, max} = IND[k], X = v => (v - min) / (max - min) * 100, fil = MULTI.some(([m]) => m === e.dim);
  const nomDim = dims.find(d => d[0] === e.dim)[1];
  return `<section class="panel" data-rk="${id}"><header><h2>${IND[k].corto} por ${nomDim.toLowerCase()}</h2>
    <div class="herr"><div class="seg" role="group" aria-label="Abrir por">${dims.map(([d, t]) => `<button type="button" data-dim="${d}" aria-pressed="${e.dim === d}">${t}</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="Ordenar"><button type="button" data-ord="n" aria-pressed="${e.orden === 'n'}">Volumen</button><button type="button" data-ord="peor" aria-pressed="${e.orden === 'peor'}">Peor</button><button type="button" data-ord="mejor" aria-pressed="${e.orden === 'mejor'}">Mejor</button></div></div></header>
    <div class="tw"><table class="rk"><caption class="sr">${IND[k].nombre} por ${nomDim}</caption><thead><tr><th>${nomDim}</th><th class="num">n</th><th class="num">${IND[k].corto}</th><th><span aria-hidden="true">│ total ${fmt(k, tot)}</span><span class="sr">barra</span></th><th class="num">vs total</th></tr></thead><tbody>
    ${vis.map(x => { const d = tot ? x.r.v - tot.v : 0, b = min < 0 ? `left:${Math.min(X(0), X(x.r.v))}%;width:${Math.abs(X(x.r.v) - X(0))}%` : `left:0;width:${X(x.r.v)}%`;
      return `<tr class="${x.r.n < NMIN ? 'poca' : ''}${fil ? ' clic' : ''}${fil && st[e.dim].has(x.v) ? ' sel' : ''}" ${fil ? `tabindex="0" data-v="${x.v}"` : ''}><td class="nom">${esc(x.nombre)}${bajo(x.r)}</td><td class="num">${f0(x.r.n)}</td><td class="num"><b>${fmt(k, x.r)}</b></td><td class="bar"><div class="mini" ${tipAttr(tipInd(k, x.r))}><b style="${b}"></b>${tot ? `<span class="ref" style="left:${X(tot.v)}%"></span>` : ''}</div></td><td class="num"><span class="dif ${x.r.n < NMIN || Math.abs(d) < .05 ? '' : d > 0 ? 'mejora' : 'empeora'}">${fpp(d)}</span></td></tr>`; }).join('') || '<tr><td colspan="5" class="vacio">Sin datos</td></tr>'}
    </tbody></table></div>${g.length > tope ? `<button type="button" class="mas">${e.todos ? 'Ver menos' : `Ver los ${g.length}`}</button>` : ''}
    <p class="nota" style="margin:6px 0 0">${fil ? 'Clic en una fila para filtrar todo el tablero. ' : ''}Gris = menos de ${NMIN} encuestas (no se ordena por valor).</p></section>`;
}
function montarRanking(raiz) {
  raiz.querySelectorAll('[data-rk]').forEach(p => {
    const e = rkEst[p.dataset.rk];
    p.querySelectorAll('[data-dim]').forEach(b => b.onclick = () => { e.dim = b.dataset.dim; e.todos = false; pintarTab(); });
    p.querySelectorAll('[data-ord]').forEach(b => b.onclick = () => { e.orden = b.dataset.ord; pintarTab(); });
    p.querySelector('.mas')?.addEventListener('click', () => { e.todos = !e.todos; pintarTab(); });
    p.querySelectorAll('tr.clic').forEach(tr => { const f = () => alternar(e.dim, +tr.dataset.v); tr.onclick = f; tr.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); f(); } }; });
  });
}

// ------------------------------------------------------------------ dolores (cruce con NPS y CES)
// Conteos por fila del cubo y dolor: [n, prom, det, ces_ok, ces_val]. Los de «sin el dolor» salen por resta del total.
const DL = D.dolores, DLF = new Map();
for (const f of DL.filas) { if (!DLF.has(f[0])) DLF.set(f[0], []); DLF.get(f[0]).push(f); }
const DOLOR = {
  aviso: ['Nadie avisa ni dice cuándo vuelve', 'No hubo ningún tipo de notificación sobre la falla ni un plan de contingencia.'],
  contacto: ['Llegar a un asesor es una odisea', 'Nadie contesta, y llega un momento en que se corta la llamada.'],
  asesor: ['Solo me dicen «reinicie el módem»', 'Solo me dicen que reinicie o desconecte el módem; así no se soluciona nada.'],
  visita: ['El técnico no llega o no resuelve', 'Me agendaron cita y nunca llegaron.'],
  tiempo: ['Pasan días sin solución', 'Llevo más de 15 días y no han podido resolverlo.'],
  promesa: ['Prometen plazos que no cumplen', 'Me dicen que en 7 horas, después que en 4… y llevo 4 días sin internet.'],
  persiste: ['Cierran el caso y la falla sigue', 'Nunca llegó el técnico, perdimos el tiempo y declararon el servicio como satisfactorio.'],
  recurrente: ['La falla vuelve a los pocos días', 'Funcionó un día y hoy otra vez no tengo internet.'],
  cobro: ['Pago completo por días sin servicio', 'Fueron 3 días sin teléfono, internet ni televisión, y la factura llega igual.'],
};
const dolEst = {rango: 'mes'};
function filasDolor() {
  if (dolEst.rango === 'mes') return filas();
  const anio = PERIODOS[st.periodo].slice(0, 4);
  return filas({periodo: null}).filter(i => { const p = PERIODOS[D.cubo[i][0]]; return p.slice(0, 4) === anio && D.cubo[i][0] <= st.periodo; });
}
const npsDe = (n, prom, det) => n ? (prom - det) / n * 100 : null;
const cesDe = (ok, val) => val ? ok / val * 100 : null;
function calcDolores(idx) {
  const a = sumar(idx), s = DL.claves.map(() => [0, 0, 0, 0, 0]);
  for (const i of idx) for (const f of DLF.get(i) || []) { const t = s[f[1]]; for (let j = 0; j < 5; j++) t[j] += f[2 + j]; }
  const cv = a.q6_1 + a.q6_2 + a.q6_3 + a.q6_4 + a.q6_5, cok = a.q6_4 + a.q6_5;
  const tot = {n: a.n, nps: npsDe(a.n, a.prom, a.det), ces: cesDe(cok, cv)};
  const fila = (k, [n, prom, det, ok, val]) => {
    const con = npsDe(n, prom, det), sin = npsDe(a.n - n, a.prom - prom, a.det - det);
    return {k, n, nSin: a.n - n, pct: a.n ? n / a.n * 100 : 0, con, sin, cesCon: cesDe(ok, val), cesSin: cesDe(cok - ok, cv - val),
      pts: con != null && sin != null ? n / a.n * (sin - con) : null};
  };
  const todas = DL.claves.map((k, i) => fila(k, s[i]));
  return {tot, alguno: todas.find(x => x.k === 'alguno'), dol: todas.filter(x => x.k !== 'alguno')};
}
// Pista de −100 a 100 (NPS) o de 0 a 100 (CES) con los dos puntos: con el dolor y sin él
function pista(con, sin, min, ref, suf, tip) {
  if (con == null || sin == null) return '<div class="pz vacia">—</div>';
  const X = v => (v - min) / (100 - min) * 100, lo = Math.min(con, sin), hi = Math.max(con, sin);
  const etq = v => `${f0(v)}${suf}`;
  return `<div class="pz" ${tipAttr(tip)}><div class="riel">${min < 0 ? '<span class="cero" style="left:50%"></span>' : ''}
    ${ref != null ? `<span class="ref" style="left:${X(ref)}%"></span>` : ''}
    <span class="tramo" style="left:${X(lo)}%;width:${X(hi) - X(lo)}%"></span>
    <span class="pt sin" style="left:${X(sin)}%"></span><span class="pt con" style="left:${X(con)}%"></span>
    <span class="lbl izq" style="right:${100 - X(lo)}%">${etq(lo)}</span><span class="lbl der" style="left:${X(hi)}%">${etq(hi)}</span></div></div>`;
}
function vDolores() {
  const idx = filasDolor(), {tot, alguno, dol} = calcDolores(idx);
  const rango = dolEst.rango === 'mes' ? mesL(PERIODOS[st.periodo]) : `ene a ${MES[+PERIODOS[st.periodo].slice(4) - 1]} ${PERIODOS[st.periodo].slice(0, 4)}`;
  const orden = dol.filter(x => x.n).sort((a, b) => (b.n >= NMIN) - (a.n >= NMIN) || b.pts - a.pts);
  const maxPts = Math.max(1, ...orden.filter(x => x.n >= NMIN).map(x => x.pts));
  const X = v => (v + 100) / 2;
  const techo = alguno && alguno.sin != null && alguno.nSin >= NMIN ? alguno.sin : null;
  const cab = tot.nps == null ? '' : `
    <div class="dol-hero">
      <div class="dh-num"><span>NPS hoy</span><b>${f1(tot.nps)}</b></div>
      <div class="dh-pista" ${tipAttr(`<div class="t">Techo teórico</div>Las ${f0(alguno.nSin)} encuestas que no mencionan ningún dolor dan un NPS de ${techo == null ? '—' : f1(techo)}. Si todos calificaran así, el NPS subiría ${techo == null ? '—' : f1(techo - tot.nps)} pts.`)}>
        <div class="riel"><span class="cero" style="left:50%"></span>
          ${techo == null ? '' : `<span class="flujo" style="left:${X(Math.min(tot.nps, techo))}%;width:${Math.abs(X(techo) - X(tot.nps))}%"></span><span class="pt fin" style="left:${X(techo)}%"></span>`}
          <span class="pt hoy" style="left:${X(tot.nps)}%"></span></div>
        <div class="escala"><span>−100</span><span>0</span><span>100</span></div></div>
      <div class="dh-num der"><span>Sin ningún dolor</span><b>${techo == null ? '—' : f1(techo)}</b></div>
      <div class="dh-pts"><b>${techo == null ? '—' : fpp(techo - tot.nps)}</b><span>pts de NPS en juego</span></div>
      <p class="dh-pie">${f1(alguno.pct)} % de las encuestas (${f0(alguno.n)} de ${f0(tot.n)}) menciona al menos un dolor. Su NPS es ${f1(alguno.con)}${alguno.cesCon != null ? ` y su CES ${f1(alguno.cesCon)} %` : ''}.</p>
    </div>`;
  const filasH = orden.map((x, i) => {
    const [tit, cita] = DOLOR[x.k], poca = x.n < NMIN, br = x.sin - x.con;
    const tipN = `<div class="t">${esc(tit)}</div>NPS con el dolor: <b>${f1(x.con)}</b> (n ${f0(x.n)})<br>NPS sin el dolor: <b>${f1(x.sin)}</b> (n ${f0(x.nSin)})<br>Brecha: ${f1(br)} pts`;
    const tipC = `<div class="t">CES · ${esc(tit)}</div>Con el dolor: <b>${x.cesCon == null ? '—' : f1(x.cesCon) + ' %'}</b><br>Sin el dolor: <b>${x.cesSin == null ? '—' : f1(x.cesSin) + ' %'}</b>${x.cesCon != null && x.cesSin != null ? `<br>Brecha: ${f1(x.cesSin - x.cesCon)} pp` : ''}`;
    const tipP = `<div class="t">Si este dolor desapareciera</div>Quienes lo viven (${f1(x.pct)} %) pasarían a calificar como quienes no lo viven: el NPS iría de ${f1(tot.nps)} a ${f1(x.sin)}.<br>${f1(x.pct)} % × ${f1(br)} pts de brecha = <b>${fpp(x.pts)} pts</b>`;
    return `<li class="dol${poca ? ' poca' : ''}">
      <span class="rk">${String(i + 1).padStart(2, '0')}</span>
      <div class="qu"><span class="mom">${DL.momentos[x.k]}</span><b>${esc(tit)}</b><q>${esc(cita)}</q></div>
      <div class="vive"><b>${f1(x.pct)} %</b><span>${f0(x.n)} encuestas</span>${poca ? '<span class="bajo">muestra baja</span>' : ''}</div>
      ${pista(x.con, x.sin, -100, tot.nps, '', tipN)}
      ${pista(x.cesCon, x.cesSin, 0, tot.ces, ' %', tipC)}
      <div class="gana" ${tipAttr(tipP)}><b>${x.pts == null ? '—' : fpp(x.pts)}</b><small>pts</small><span class="barrita"><i style="width:${poca || x.pts == null ? 0 : Math.max(0, x.pts) / maxPts * 100}%"></i></span></div>
    </li>`;
  }).join('');
  return `<section class="panel dolores" id="dolores"><header><h2>Dolores del cliente</h2>
      <div class="herr"><div class="seg" role="group" aria-label="Periodo de los dolores" id="dol-r"><button type="button" data-r="mes" aria-pressed="${dolEst.rango === 'mes'}">Mes</button><button type="button" data-r="acum" aria-pressed="${dolEst.rango === 'acum'}">Año corrido</button></div></div>
      <p class="sub">${alcance()} · ${rango}. Lo que cuentan los clientes en sus comentarios, cruzado con lo que responden de NPS y CES. Arriba, el dolor que más puntos de NPS le quita a la nota.</p></header>
    ${cab}
    <div class="dol-ley" aria-hidden="true"><span></span><span>Lo vive</span><span><i class="pt con"></i>Con el dolor <i class="pt sin"></i>Sin el dolor <i class="ref"></i>Total del corte · NPS</span><span>CES</span><span>NPS que recupera</span></div>
    <ol class="dol-lista">${filasH || '<li class="vacio">Sin encuestas con estos filtros</li>'}</ol>
    <p class="nota dol-nota">Cada dolor sale de los comentarios (Q3, Q13, Q7 y Q10) con las mismas reglas de los análisis de dolores de Soporte y Fallas masivas. «La falla sigue» suma además a quien responde que su servicio no funciona (Q8). Los puntos son teóricos: suponen que quien deja de vivir el dolor califica igual que quien nunca lo vivió. Como un cliente puede tener varios dolores, los puntos de las filas no se suman; el número de arriba cuenta cada encuesta una sola vez.</p>
  </section>`;
}

// ------------------------------------------------------------------ vistas
function vResumen(p) {
  const a = sumar(filas()), ant = st.periodo > 0 ? st.periodo - 1 : null, aAnt = ant != null ? sumar(filas({periodo: ant})) : null, etA = ant != null ? mesC(PERIODOS[ant]) : '';
  const porE = EST.map((_, e) => sumar(filas({estudio: e})));
  const kpis = KS.map((k, i) => {
    const r = IND[k].calc(a), pr = aAnt ? IND[k].calc(aAnt) : null;
    return `<article class="kpi${i === 0 ? ' estrella' : ''}">${i === 0 ? '<span class="glow"></span>' : ''}
      <div class="et">${i === 0 ? IND[k].nombre : IND[k].corto} <span class="info" tabindex="0" ${tipAttr(esc(IND[k].def))}>?</span></div>
      <div class="v" ${tipAttr(tipInd(k, r))}>${fmtGrande(k, r)}</div>
      <div class="pie">${delta(k, r, pr, etA)}</div>
      ${spark(k)}
      <div class="pie"><span>n ${r ? f0(r.n) : 0}${r ? ` · ±${f1(r.ic)}` : ''}</span>${bajo(r)}<button type="button" class="ver" data-cajon="${k}" aria-label="Ver detalle y comentarios de ${IND[k].nombre}">Voces ›</button></div></article>`;
  }).join('');
  const vs = KS.map(k => { const rs = porE.map(x => IND[k].calc(x)), br = rs[0] && rs[1] ? rs[0].v - rs[1].v : null;
    return `<div class="f"><div class="n">${IND[k].corto}<small>${rs.map(r => fmt(k, r)).join(' · ')}</small></div>${pesa(k, rs)}<div class="b">${br == null ? '—' : fpp(br)}<small>Sop − FM</small></div></div>`; }).join('');
  p.innerHTML = `
    <section class="kpis" aria-label="Indicadores de ${mesL(PERIODOS[st.periodo])}">${kpis}</section>
    <div class="g g-2-1" style="min-height:0">
      <section class="panel"><header><h2>${IND[st.evo].nombre} · ${st.modo === 'mes' ? 'mes a mes' : 'semana a semana, ' + mesL(PERIODOS[st.periodo])}</h2>
        <div class="herr"><div class="seg" role="group" aria-label="Indicador" id="evo-k">${KS.map(k => `<button type="button" data-k="${k}" aria-pressed="${st.evo === k}">${IND[k].corto}</button>`).join('')}</div>
        ${PERIODOS.length > 1 ? `<div class="seg" role="group" aria-label="Agrupar" id="evo-m"><button type="button" data-m="mes" aria-pressed="${st.modo === 'mes'}">Mes</button><button type="button" data-m="semana" aria-pressed="${st.modo === 'semana'}">Semana</button></div>` : ''}</div>
        <div class="leyenda" style="flex-basis:100%">${ests().map(e => `<span><i class="l" style="background:${CE[EST[e]]}"></i>${EST[e]}</span>`).join('')}<span class="nota">Punto hueco = menos de ${NMIN} encuestas</span>${tablaPH('evo')}</div></header>
        ${lineasPH(st.evo, st.modo, 'evo')}</section>
      <section class="panel"><header><h2 ${tipAttr('Mismo mes y filtros, sin el filtro de estudio. Escala: NPS de −100 a 100; el resto de 0 a 100 %.')}>Soporte vs Falla masiva <span class="info">?</span></h2><div class="leyenda">${EST.map(e => `<span><i style="background:${CE[e]}"></i>${e === 'Falla masiva' ? 'FM' : e}</span>`).join('')}</div></header><div class="vs">${vs}</div></section>
    </div>
    ${vDolores()}
    ${carrusel('res', ['det', 'pro', 'dif', 'nof', 'amal'])}`;
  p.querySelectorAll('#dol-r button').forEach(b => b.onclick = () => { dolEst.rango = b.dataset.r; pintarTab(); });
  p.querySelectorAll('#evo-k button').forEach(b => b.onclick = () => { st.evo = b.dataset.k; pintarTab(); });
  p.querySelectorAll('#evo-m button').forEach(b => b.onclick = () => { st.modo = b.dataset.m; pintarTab(); });
}
function vFacilidad(p) {
  const idx = filas(), a = sumar(idx);
  const gr = [...ests().map(e => ({nombre: EST[e], a: sumar(filas({estudio: e}))})), ...(st.estudio == null ? [{nombre: 'Total', a}] : [])];
  p.innerHTML = `
    <section class="panel"><header><h2>¿Qué tan fácil fue contactar a un asesor?</h2><p class="sub">Q6 · centrado en «Ni fácil ni difícil»: a la izquierda lo difícil, a la derecha lo fácil.</p></header>${divergente(gr)}</section>
    ${carrusel('fac', ['dif', 'fac'])}
    <div class="g g2"><section class="panel"><header><h2>Qué fue difícil</h2><p class="sub">Temas de Qualtrics en Q7 · % sobre las ${f0(a.com_q7)} encuestas que escribieron algo.</p></header>${barras(temas(TD, D.temas.dificil, idx), a.com_q7, () => 'var(--d-2)')}</section>${ranking('ces', 'ces')}</div>`;
}
function vResolucion(p) {
  const idx = filas(), gr = [...ests().map(e => ({nombre: EST[e], a: sumar(filas({estudio: e}))})), ...(st.estudio == null ? [{nombre: 'Total', a: sumar(idx)}] : [])];
  const br = gr.map(g => { const a = g.a, si = a.q8_si ? (a.prom_si - a.det_si) / a.q8_si * 100 : null, no = a.q8_no ? (a.prom_no - a.det_no) / a.q8_no * 100 : null;
    return `<div class="bf"><div class="et"><b>${esc(g.nombre)}</b><br><span class="nota">${fmt('fun', IND.fun.calc(a))} funciona</span></div>
      <div class="c"><span>NPS si funciona</span><b>${si == null ? '—' : f1(si)}</b><span>n ${f0(a.q8_si)}</span></div>
      <div class="c"><span>NPS si no funciona</span><b>${no == null ? '—' : f1(no)}</b><span>n ${f0(a.q8_no)}</span></div>
      <div class="c gap"><span>Brecha</span><b>${si != null && no != null ? f1(si - no) : '—'}</b><span>pts de NPS</span></div></div>`; }).join('');
  p.innerHTML = `
    <div class="g g2"><section class="panel"><header><h2>¿Quedó funcionando el servicio?</h2><p class="sub">Q8 · NPS de quienes dicen que funciona frente a quienes dicen que no.</p></header><div class="brechas">${br}</div></section>
      <section class="panel"><header><h2>Composición</h2></header>${apilada(gr, PARTES_FUN, 'fun')}<div style="height:10px"></div>${apilada(gr, PARTES_NPS, 'nps')}</section></div>
    ${carrusel('resol', ['nof', 'sif'])}
    <div class="g g2">${ranking('fun', 'fun')}${ranking('nps', 'nps')}</div>`;
}
function vAsesor(p) {
  const gr = ests().map(e => ({e: EST[e], a: sumar(filas({estudio: e}))}));
  const q9 = D.q9.map((nom, j) => { const q = `q9_${j + 1}`, rs = gr.map(g => ({e: g.e, r: prop(g.a[q + '_top2'], g.a[q + '_val'])}));
    return `<div class="barra doble"><span class="et">${esc(nom)}</span><span class="p">${rs.map(x => `<span ${tipAttr(x.r ? `<div class="t">${esc(nom)} · ${x.e}</div>${f1(x.r.v)} % califica 4–5 · n ${f0(x.r.n)}` : 'Sin datos')}><b style="width:${x.r ? x.r.v : 0}%;background:${CE[x.e]}"></b></span>`).join('')}</span><span class="num">${rs.map(x => x.r ? f1(x.r.v) + ' %' : '—').join('<br>')}</span></div>`; }).join('');
  p.innerHTML = `
    <div class="g g-1-2"><section class="panel"><header><h2>Desempeño del asesor</h2><div class="leyenda">${gr.map(g => `<span><i style="background:${CE[g.e]}"></i>${g.e}</span>`).join('')}</div><p class="sub">Q9 · % que califica 4 o 5 cada atributo.</p></header><div class="barras" style="gap:14px">${q9}</div></section>
      ${ranking('ase', 'ase', [['aliado', 'Aliado'], ['operacion', 'Operación'], ['marcacion', 'Marcación'], ['region', 'Región']])}</div>
    ${carrusel('ase', ['amal', 'abien'])}`;
}
const exEst = {lente: '', q: '', ver: 36};
function vVoz(p) {
  const idx = filas(), a = sumar(idx);
  const EMO_C = ['var(--d-2)', 'var(--d-2)', 'var(--d-1)', 'var(--d-1)', 'var(--d0)', 'var(--d1)', 'var(--d1)', 'var(--d2)', 'var(--d2)'];
  const emos = D.emociones.map((e, i) => ({nombre: e, c: a['emo_' + i], i})).filter(x => x.c), be = emos.reduce((s, x) => s + x.c, 0);
  const ej = C ? ejemplos(exEst.lente || null, exEst.ver, norm(exEst.q)) : null;
  p.innerHTML = `
    <div class="g g2"><section class="panel"><header><h2>Emociones</h2><p class="sub">Q5 · rojo = negativas, azul = positivas.</p></header>${barras(emos, be, x => EMO_C[x.i])}</section>
      <section class="panel"><header><h2>Cómo mejorar al asesor</h2><p class="sub">Temas de Qualtrics en Q10 · % sobre ${f0(a.com_q10)} encuestas con comentario.</p></header>${barras(temas(TM, D.temas.mejora, idx), a.com_q10, () => 'var(--d2)')}</section></div>
    <section class="panel"><header><h2>Explorador de comentarios</h2><span class="nota">${ej ? f0(ej.total) + ' comentarios' : 'Cargando…'}</span></header>
      <div class="ex-herr"><input type="search" id="ex-q" placeholder="Buscar: visita, técnico, whatsapp, factura…" value="${esc(exEst.q)}" aria-label="Buscar en comentarios">
        <div class="seg" role="group" aria-label="Tipo"><button type="button" data-l="" aria-pressed="${!exEst.lente}">Todos</button>${Object.entries(LENTES).map(([k, l]) => `<button type="button" data-l="${k}" aria-pressed="${exEst.lente === k}">${l.t}</button>`).join('')}</div></div>
      <div class="ex">${ej == null ? Array(6).fill('<div class="esqueleto"></div>').join('') : ej.items.map(v => tarjeta(v, exEst.q)).join('') || '<p class="vacio">Sin comentarios</p>'}</div>
      ${ej && ej.total > ej.items.length ? `<button type="button" class="mas" id="ex-mas">Ver más (${f0(ej.total - ej.items.length)} restantes)</button>` : ''}</section>`;
  const q = p.querySelector('#ex-q'); let t;
  q.oninput = () => { clearTimeout(t); t = setTimeout(() => { exEst.q = q.value.trim(); exEst.ver = 36; pintarTab(); const n = p.querySelector('#ex-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  p.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { exEst.lente = b.dataset.l; exEst.ver = 36; pintarTab(); });
  p.querySelector('#ex-mas')?.addEventListener('click', () => { exEst.ver += 36; pintarTab(); });
}
function vCalidad(p) {
  const per = PERIODOS[st.periodo], inf = D.periodos[per], o = {error: 0, aviso: 1, ok: 2}, ico = {ok: '✓', aviso: '!', error: '✕'};
  const ch = [...inf.calidad].sort((a, b) => o[a.nivel] - o[b.nivel]), n = l => ch.filter(c => c.nivel === l).length;
  p.innerHTML = `
    <div class="g g-2-1"><section class="panel"><header><h2>Contrato de datos · ${mesL(per)}</h2><span class="nota">${n('ok')} correctos · ${n('aviso')} avisos · ${n('error')} errores</span><p class="sub">Un «error» detiene la actualización y no se publica. Los avisos se explican aquí. Elige el mes:</p></header>
      <div class="meses" role="group" aria-label="Mes">${PERIODOS.map((pp, i) => { const a = D.periodos[pp].calidad.filter(c => c.nivel !== 'ok').length; return `<button type="button" data-i="${i}" aria-pressed="${i === st.periodo}">${mesC(pp)} · ${a} avisos</button>`; }).join('')}</div><div style="height:10px"></div>
      <div class="checks">${ch.map(c => `<div class="check ${c.nivel}"><span class="ico" aria-hidden="true">${ico[c.nivel]}</span><div><b>${esc(c.titulo)}</b><span class="sr"> (${c.nivel})</span><p>${esc(c.detalle)}</p></div></div>`).join('')}</div></section>
      <div class="g" style="align-content:start"><section class="panel"><header><h2>Fuente</h2></header><dl class="defs"><dt>Tabla</dt><dd>${esc(D.tabla)} · Oracle, solo lectura</dd><dt>Encuestas</dt><dd>${f0(inf.n)} en ${mesL(per)} · ${f0(PERIODOS.reduce((s, pp) => s + D.periodos[pp].n, 0))} en total</dd><dt>Carga en Oracle</dt><dd>${esc(inf.fecha_carga)}</dd><dt>Procesado</dt><dd>${esc(inf.generado)}</dd><dt>Comentarios</dt><dd>${f0(D.n_comentarios)}, con datos personales tapados</dd></dl></section>
        <section class="panel"><header><h2>Definiciones</h2></header><dl class="defs">${KS.map(k => `<dt>${IND[k].corto}</dt><dd>${esc(IND[k].def)}</dd>`).join('')}
          <dt>Mes</dt><dd>Mes de RECORDEDDATE (cuando Qualtrics registró la respuesta); coincide con los exportes oficiales.</dd><dt>Unidad</dt><dd>La encuesta (RESPONSEID).</dd><dt>IC 95 %</dt><dd>Margen de error por muestreo. Diferencias menores pueden ser ruido.</dd><dt>Red</dt><dd>BIDIRECCIONAL = HFC, FTT = FTTH.</dd></dl></section></div></div>`;
  p.querySelectorAll('.meses button').forEach(b => b.onclick = () => { st.periodo = +b.dataset.i; refrescar(); });
}
const VISTAS = {resumen: vResumen, facilidad: vFacilidad, resolucion: vResolucion, asesor: vAsesor, voz: vVoz, calidad: vCalidad};
function pintarTab() {
  const p = document.getElementById('p-' + st.tab);
  VISTAS[st.tab](p);
  montarRanking(p); montarCarrusel(p); dibujarLineas(p);
  p.querySelectorAll('[data-cajon]').forEach(b => b.onclick = () => abrirCajon(b.dataset.cajon));
  if (!C && st.tab !== 'calidad') cargarComentarios();
}

// ------------------------------------------------------------------ spotlight por indicador
const cajon = document.getElementById('cajon'), velo = document.getElementById('velo'); let volverA = null;
function abrirCajon(k, foco = true) {
  if (foco) volverA = document.activeElement;
  const a = sumar(filas()), r = IND[k].calc(a), [malo, bueno] = PAR[k];
  const gr = ests().map(e => ({nombre: EST[e], a: sumar(filas({estudio: e}))}));
  const dist = k === 'nps' ? apilada(gr, PARTES_NPS, 'nps') : k === 'fun' ? apilada(gr, PARTES_FUN, 'fun') : k === 'ces' ? divergente(gr) :
    `<div class="barras">${D.q9.map((nom, j) => { const q = `q9_${j + 1}`, x = prop(a[q + '_top2'], a[q + '_val']); return `<div class="barra"><span class="et">${esc(nom)}</span><span class="p"><b style="width:${x ? x.v : 0}%;background:var(--d2)"></b></span><span class="num">${x ? f1(x.v) + ' %' : '—'}</span></div>`; }).join('')}</div>`;
  const col = l => { const ej = ejemplos(l, 4); return `<div class="col"><h4><i class="punto" style="background:${LENTES[l].malo ? 'var(--d-2)' : 'var(--d2)'}"></i>${LENTES[l].t}${ej ? ` <span class="nota">${f0(ej.total)}</span>` : ''}</h4>${ej == null ? '<div class="esqueleto"></div>' : ej.items.map(v => tarjeta(v)).join('') || '<p class="nota">Sin comentarios</p>'}</div>`; };
  cajon.dataset.k = k;
  cajon.innerHTML = `<header><span class="nota">${mesL(PERIODOS[st.periodo])} · ${alcance()}</span><h2 id="cajon-t" style="margin:0;font:900 22px var(--f-num)">${IND[k].nombre}</h2>
      <div class="big">${fmtGrande(k, r)}</div><p class="def">${esc(IND[k].def)}</p><span class="nota">n ${r ? f0(r.n) : 0}${r ? ` · IC 95 % ±${f1(r.ic)}` : ''}</span>
      <button type="button" class="icono x" aria-label="Cerrar">${svgI('x')}</button></header>
    <div class="cuerpo"><div><h3>Mes a mes</h3><div class="chart" style="min-height:170px" data-lineas="${k}" data-modo="mes" id="cj-l"></div>${tablaPH('cj-l')}</div>
      <div><h3>Distribución</h3>${dist}</div>
      <div><h3>Lo que dicen</h3><div class="dos">${col(malo)}${col(bueno)}</div>
      <button type="button" class="mas" id="cj-mas">Ver todos en Voces ›</button></div></div>`;
  cajon.hidden = velo.hidden = false;
  requestAnimationFrame(() => { cajon.classList.add('ver'); velo.classList.add('ver'); dibujarLineas(cajon); });
  cajon.querySelector('.x').onclick = cerrarCajon;
  cajon.querySelector('#cj-mas').onclick = () => { exEst.lente = malo; cerrarCajon(); irA('voz'); };
  montarCarrusel(cajon);
  if (foco) cajon.querySelector('.x').focus();
  if (!C) cargarComentarios();
}
function cerrarCajon() {
  cajon.classList.remove('ver'); velo.classList.remove('ver'); delete cajon.dataset.k;
  setTimeout(() => { if (!cajon.dataset.k) cajon.hidden = velo.hidden = true; }, 300);
  volverA?.focus?.();
}
velo.onclick = cerrarCajon;
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && cajon.dataset.k) cerrarCajon();
  if (e.key === 'Tab' && cajon.dataset.k) { const f = [...cajon.querySelectorAll('button,[tabindex="0"],summary')]; if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); } }
});

// ------------------------------------------------------------------ descarga de la base (filtros activos)
const dl = document.getElementById('dl'), dlPop = document.getElementById('dl-pop'), dlAbrir = document.getElementById('dl-abrir');
const dlEst = {alcance: 'mes', formato: 'xlsx'};
const slug = t => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const filtrosTxt = () => [st.estudio != null ? EST[st.estudio] : '', ...MULTI.filter(([k]) => st[k].size).map(([k, et]) => `${et}: ${[...st[k]].map(i => V[k][i]).join(', ')}`)].filter(Boolean).join(' · ') || 'Sin filtros';
function dlPeriodos() { return dlEst.alcance === 'mes' ? [PERIODOS[st.periodo]] : D.base.periodos; }
function dlNombre() {
  const ps = dlPeriodos(), f = [st.estudio != null ? slug(EST[st.estudio]) : '', ...MULTI.filter(([k]) => st[k].size).map(([k]) => [...st[k]].map(i => slug(V[k][i])).join('-'))].filter(Boolean);
  return `soporte_fm_base_${ps[0]}${ps.length > 1 ? '_a_' + ps[ps.length - 1] : ''}${f.length ? '_' + f.join('_').slice(0, 80) : ''}.${dlEst.formato}`;
}
function pintarDescarga() {
  if (dlPop.hidden) return;
  const n = sumar(filas(dlEst.alcance === 'mes' ? {} : {periodo: null})).n;
  const ocupado = dlPop.querySelector('.ir')?.dataset.estado === 'trabajando';
  if (ocupado) return;
  dlPop.innerHTML = `<h3>Descargar base de encuestas</h3>
    <div><div class="et-dl">Meses</div><div class="seg" role="group" aria-label="Meses"><button type="button" data-a="mes" aria-pressed="${dlEst.alcance === 'mes'}">${mesL(PERIODOS[st.periodo])}</button><button type="button" data-a="todos" aria-pressed="${dlEst.alcance === 'todos'}">Todos (${mesC(D.base.periodos[0])} a ${mesC(D.base.periodos[D.base.periodos.length - 1])})</button></div></div>
    <div><div class="et-dl">Formato</div><div class="seg" role="group" aria-label="Formato"><button type="button" data-f="xlsx" aria-pressed="${dlEst.formato === 'xlsx'}" title="Libro de Excel (.xlsx)">Excel</button><button type="button" data-f="csv" aria-pressed="${dlEst.formato === 'csv'}" title="Texto separado por punto y coma">CSV</button><button type="button" data-f="parquet" aria-pressed="${dlEst.formato === 'parquet'}" title="Columnar y comprimido, para Python o Power BI">Parquet</button></div></div>
    <div class="resumen-dl"><b>${f0(n)} encuestas</b>${esc(filtrosTxt())}</div>
    <button type="button" class="ir"${n ? '' : ' disabled'}><span>Descargar ${dlEst.formato === 'xlsx' ? 'Excel' : dlEst.formato.toUpperCase()}</span></button>
    <p class="nota" style="margin:0">Una fila por encuesta con indicadores, segmentos y comentarios. Sin datos personales: no trae nombre, teléfono, correo, cédula ni cuenta; los comentarios van con [nombre], [#] y [correo] tapados.</p>`;
  dlPop.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { dlEst.alcance = b.dataset.a; pintarDescarga(); });
  dlPop.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { dlEst.formato = b.dataset.f; pintarDescarga(); });
  dlPop.querySelector('.ir').onclick = e => descargarBase(e.currentTarget);
}
const cargarBase = p => new Promise((ok, mal) => {
  if (window.BASE?.[p]) return ok(window.BASE[p]);
  const sc = document.createElement('script'); sc.src = `base/${p}.js`;
  sc.onload = () => window.BASE?.[p] ? ok(window.BASE[p]) : mal(new Error(p)); sc.onerror = () => mal(new Error(p));
  document.body.appendChild(sc);
});
const lineaCSV = f => f.map(v => /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(';');
async function descargarBase(btn) {
  if (btn.dataset.estado === 'trabajando') return;
  const txt = btn.querySelector('span'), etq = txt.textContent, aviso = (e, t, p) => { btn.dataset.estado = e; txt.textContent = t; btn.style.setProperty('--p', (p ?? 0) + '%'); };
  try {
    const cols = D.base.columnas, ci = c => cols.indexOf(c), ps = dlPeriodos();
    const conds = [];
    if (st.estudio != null) { const j = ci(D.base.filtro.estudio), v = EST[st.estudio]; conds.push(r => r[j] === v); }
    for (const [k] of MULTI) if (st[k].size) { const j = ci(D.base.filtro[k]), vs = new Set([...st[k]].map(i => V[k][i])); conds.push(r => vs.has(r[j])); }
    const w = EXPORTAR.crear(dlEst.formato, cols);
    let n = 0;
    for (let i = 0; i < ps.length; i++) {
      aviso('trabajando', `Preparando ${Math.round(i / ps.length * 100)} %`, i / ps.length * 100);
      const rows = (await cargarBase(ps[i])).filter(r => conds.every(c => c(r)));
      for (let j = 0; j < rows.length; j += 5000) await w.agregar(rows.slice(j, j + 5000).map(lineaCSV));
      n += rows.length;
    }
    aviso('trabajando', 'Generando archivo…', 100);
    const blob = await w.cerrar(), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = dlNombre(); a.addEventListener('click', e => e.stopPropagation()); a.click();   // sin insertarlo: su clic no debe cerrar el panel
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    aviso('listo', `Listo: ${f0(n)} filas`, 100);
  } catch (e) {
    console.warn(e); aviso('error', 'No se pudo descargar (¿abierto sin servidor?)', 0);
  }
  setTimeout(() => { delete btn.dataset.estado; txt.textContent = etq; btn.style.removeProperty('--p'); }, 3500);
}
dlAbrir.onclick = e => { e.stopPropagation(); const si = dlPop.hidden; dlPop.hidden = !si; dlAbrir.setAttribute('aria-expanded', si); if (si) { pintarDescarga(); dlPop.querySelector('.ir')?.focus(); } };
dlPop.addEventListener('click', e => e.stopPropagation());   // el panel se repinta al elegir opciones: que el clic no lo cierre
dl.addEventListener('keydown', e => { if (e.key === 'Escape' && !dlPop.hidden) { dlPop.hidden = true; dlAbrir.setAttribute('aria-expanded', false); dlAbrir.focus(); } });
document.addEventListener('click', e => { if (!dl.contains(e.target) && !dlPop.hidden && dlPop.querySelector('.ir')?.dataset.estado !== 'trabajando') { dlPop.hidden = true; dlAbrir.setAttribute('aria-expanded', false); } });

// ------------------------------------------------------------------ tema
const btnTema = document.getElementById('tema');
function pintarTema() {
  const osc = document.documentElement.dataset.theme === 'dark';
  btnTema.innerHTML = svgI(osc ? 'sol' : 'luna') + `<span class="tx">${osc ? 'Modo claro' : 'Modo oscuro'}</span>`;
  btnTema.setAttribute('aria-label', osc ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  btnTema.title = osc ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
}
btnTema.onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t; try { localStorage.setItem('sopfm-tema', t); } catch (e) { /* sin almacenamiento */ }
  pintarTema(); pintarTab();
};

// ------------------------------------------------------------------ ciclo
function refrescar(o = {}) {
  pintarCtrl(); pintarFiltros();
  if (o.mantener) barF.querySelector(`.pill-f[data-k="${o.mantener}"] button`)?.click();
  pintarNav(); pintarTab(); escribirHash(); pintarDescarga();
  if (cajon.dataset.k) abrirCajon(cajon.dataset.k, false);
}
leerHash();
const ult = PERIODOS[PERIODOS.length - 1];
document.getElementById('actualizado').textContent = D.generado.slice(0, 10).split('-').reverse().join('/');
document.getElementById('sello').textContent = `${mesC(PERIODOS[0])} a ${mesC(ult)} · ${f0(PERIODOS.reduce((s, p) => s + D.periodos[p].n, 0))} encuestas`;
pintarTema(); refrescar();
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { dibujarLineas(document.getElementById('p-' + st.tab)); if (cajon.dataset.k) dibujarLineas(cajon); }, 150); });
addEventListener('hashchange', () => { leerHash(); refrescar(); });
})();
