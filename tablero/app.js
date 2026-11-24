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
  fun: {nombre: 'Servicio funcionando', corto: 'Serv. Funcionando', min: 0, max: 100,
    def: '% que responde «Sí» a Q8 «¿Tu servicio se encuentra funcionando correctamente?». Base: Sí + No (las encuestas sin terminar no cuentan).',
    calc: a => prop(a.q8_si, a.q8_si + a.q8_no)},
  ase: {nombre: 'Desempeño del asesor', corto: 'Asesor', min: 0, max: 100,
    def: '% de calificaciones 4–5 (escala 1–5) en los cuatro atributos del asesor (Q9: profesionalismo, amabilidad, claridad y tiempo). n = encuestas que lo calificaron.',
    calc: a => { const b = a.q9_1_val + a.q9_2_val + a.q9_3_val + a.q9_4_val, n = Math.max(a.q9_1_val, a.q9_2_val, a.q9_3_val, a.q9_4_val);
      if (!b) return null; const p = (a.q9_1_top2 + a.q9_2_top2 + a.q9_3_top2 + a.q9_4_top2) / b; return {v: p * 100, n, ic: 196 * Math.sqrt(p * (1 - p) / n)}; }},
};
const KS = ['nps', 'ces', 'fun', 'ase'];
const fmt = (k, r) => r == null ? '—' : (k === 'nps' ? f1(r.v) : f1(r.v) + ' %');
const fmtGrande = (k, r) => r == null ? '—' : `${G.cuenta(r.v, 1)}<small>${k === 'nps' ? 'pts' : '%'}</small>`;

// ------------------------------------------------------------------ estado + URL
const TABS = [['resumen', 'Resumen'], ['facilidad', 'Facilidad'], ['resolucion', 'Resolución'], ['asesor', 'Asesor'], ['voz', 'Voces'], ['calidad', 'Calidad']];
const st = {periodo: PERIODOS.length - 1, meses: [PERIODOS.length - 1], estudio: null, tab: 'resumen', evo: 'nps', modo: PERIODOS.length > 1 ? 'mes' : 'semana',
  ...Object.fromEntries(MULTI.map(([k]) => [k, new Set()]))};
function leerHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.has('periodo')) { const ms = h.get('periodo').split('|').map(p => PERIODOS.indexOf(p)).filter(i => i >= 0); if (ms.length) fijarMeses(ms); }
  st.estudio = h.has('estudio') && EST.includes(h.get('estudio')) ? EST.indexOf(h.get('estudio')) : null;
  if (h.has('tab') && TABS.some(t => t[0] === h.get('tab'))) st.tab = h.get('tab');
  for (const [k] of MULTI) st[k] = new Set((h.get(k) || '').split('|').filter(Boolean).map(v => V[k].indexOf(v)).filter(i => i >= 0));
}
function escribirHash() {
  const h = new URLSearchParams();
  h.set('periodo', st.meses.map(i => PERIODOS[i]).join('|'));
  if (st.estudio != null) h.set('estudio', EST[st.estudio]);
  for (const [k] of MULTI) if (st[k].size) h.set(k, [...st[k]].map(i => V[k][i]).join('|'));
  if (st.tab !== 'resumen') h.set('tab', st.tab);
  history.replaceState(null, '', '#' + h);
}

// ------------------------------------------------------------------ motor
// Meses elegidos (casillas). st.periodo = el más reciente de la selección: referencia para calidad y año corrido.
const ultimo = a => a[a.length - 1];
function fijarMeses(ms) { st.meses = [...new Set(ms)].sort((a, b) => a - b); st.periodo = ultimo(st.meses); }
// Ventana anterior para comparar: los mismos N meses justo antes de la selección (si la selección es continua)
function mesesAnteriores() {
  const m = st.meses, n = m.length, ini = m[0];
  if (ultimo(m) - ini !== n - 1 || ini - n < 0) return null;
  return Array.from({length: n}, (_, i) => ini - n + i);
}
const etqMeses = ms => ms.length === 1 ? mesL(PERIODOS[ms[0]]) : ultimo(ms) - ms[0] === ms.length - 1 ? `${mesC(PERIODOS[ms[0]])} a ${mesC(PERIODOS[ultimo(ms)])}` : ms.map(i => mesC(PERIODOS[i])).join(', ');
const etqCorta = ms => ms.length === 1 ? mesC(PERIODOS[ms[0]]) : etqMeses(ms);
// o.periodo: null = todos, número = un mes, arreglo = esos meses; si no viene, los meses elegidos
function pasa(r, o = {}) {
  const per = 'periodo' in o ? o.periodo : st.meses, est = 'estudio' in o ? o.estudio : st.estudio;
  if (per != null && (Array.isArray(per) ? !per.includes(r[0]) : r[0] !== per)) return false;
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
  const idx = filas(modo === 'mes' ? {periodo: null, estudio: e} : {estudio: e});
  return porDim(idx, modo === 'mes' ? 'periodo' : 'semana')
    .map(g => ({x: g.v, et: modo === 'mes' ? mesC(V.periodo[g.v]) : semC(V.semana[g.v]), r: IND[k].calc(g.a)}))
    .filter(p => p.r).sort((a, b) => a.x - b.x);
}

// ------------------------------------------------------------------ comentarios (carga diferida)
let C = null, DLC = [];   // DLC = dolores de la máscara «dl» de cada comentario (bit i = DLC[i])
function cargarComentarios() {
  if (C || document.getElementById('js-com')) return;
  const s = document.createElement('script'); s.src = 'comentarios.js'; s.id = 'js-com';
  s.onload = () => {
    const cm = window.COMENTARIOS, ix = Object.fromEntries(cm.campos.map((c, i) => [c, i]));
    C = cm.filas.map(f => ({r: f, grupo: f[ix.grupo], q8: f[ix.q8], q6: f[ix.q6], q2: f[ix.q2], q9: f[ix.q9], preg: D.cod_preguntas[f[ix.pregunta]], texto: f[ix.texto], dl: ix.dl == null ? 0 : f[ix.dl] || 0}));
    DLC = cm.dl_claves || [];
    delete window.COMENTARIOS;
    conComentarios(); if (cajon.dataset.k) abrirCajon(cajon.dataset.k, false);
    setTimeout(calentarNube, 400);
  };
  s.onerror = () => { C = []; conComentarios(); };
  document.body.appendChild(s);
}
// Lentes: qué comentarios ilustran cada lado de cada indicador
const LENTES = {
  det: {t: 'Detractores', malo: true, pred: v => v.grupo === 0, preg: ['Q3', 'Q13']},
  neu: {t: 'Neutros', pred: v => v.grupo === 1, preg: ['Q13']},   // los pasivos (7–8) solo responden Q13
  pro: {t: 'Promotores', pred: v => v.grupo === 2, preg: ['Q4', 'Q13']},
  dif: {t: 'Difícil contactar', c: 'Difícil', malo: true, pred: v => v.q6 === 1 || v.q6 === 2, preg: ['Q7', 'Q3']},
  fac: {t: 'Fácil contactar', c: 'Fácil', pred: v => v.q6 >= 4, preg: ['Q4', 'Q13']},
  nof: {t: 'No funciona', malo: true, pred: v => v.q8 === 0, preg: ['Q3', 'Q13']},
  sif: {t: 'Sí funciona', pred: v => v.q8 === 1, preg: ['Q4', 'Q13']},
  amal: {t: 'Asesor mal evaluado', c: 'Mal evaluado', malo: true, pred: v => v.q9 > 0 && v.q9 <= 2.5, preg: ['Q10', 'Q3']},
  abien: {t: 'Asesor bien evaluado', c: 'Bien evaluado', pred: v => v.q9 >= 4.5, preg: ['Q10', 'Q4']},
};
const PAR = {nps: ['det', 'pro'], ces: ['dif', 'fac'], fun: ['nof', 'sif'], ase: ['amal', 'abien']};
// Filtros de Voces agrupados por indicador; color del lado: malo rojo, neutro arena, bueno verde
const GRUPO_L = Object.assign({}, PAR, {nps: ['det', 'neu', 'pro']});
const tonoL = l => LENTES[l].malo ? 'var(--t0)' : l === 'neu' ? 'var(--t4)' : 'var(--t8)';
const GENERICO = /^(n\/?a|ninguna?|ninguno|nada|no|si|sí|ok|bien|bueno|buena|excelente|todo bien|gracias|mal[oa]?|regular|\.+|-+)\.?$/i;
// Filtro de un comentario: tipo (lente) + filtros globales + búsqueda (q ya normalizado). Sin el filtro de genéricos ni de largo.
const pasaCom = (v, L, q) => (!L || (L.pred(v) && L.preg.includes(v.preg))) && pasa(v.r) && (!q || (v.nt || (v.nt = norm(v.texto))).includes(q));
const util = v => { const t = v.texto.trim(); return t !== '' && !GENERICO.test(t); };
// Ejemplos representativos: filtros globales + lente, sin genéricos, largo legible, variados por marcación
function ejemplos(lente, k = 12, q = '') {
  if (!C) return null;
  const L = lente ? LENTES[lente] : null;
  const cand = C.filter(v => v.texto.length >= 25 && util(v) && pasaCom(v, L, q));
  const total = cand.length;
  cand.sort((a, b) => Math.abs(a.texto.length - 150) - Math.abs(b.texto.length - 150));
  const porM = new Map(); for (const v of cand) { const m = v.r[DI.marcacion]; if (!porM.has(m)) porM.set(m, []); porM.get(m).push(v); }
  const colas = [...porM.values()].sort((a, b) => b.length - a.length), out = [], vistos = new Set();
  for (let i = 0; out.length < k && colas.some(c => c.length > i); i++)
    for (const c of colas) { const v = c[i]; if (v && !vistos.has(v.texto) && out.length < k) { vistos.add(v.texto); out.push(v); } }
  return {total, items: out};
}
const colNota = n => n == null || n < 0 ? 'var(--ink-3)' : n <= 6 ? 'var(--d-2)' : n <= 8 ? 'var(--ink-3)' : 'var(--d2)';
// Chip con la recomendación (0 a 10) de quien escribió el comentario
const chipNota = v => `<span class="nota-nps" style="background:${colNota(v.q2)}" ${tipAttr(`Recomendación: ${v.q2 < 0 ? '—' : v.q2 + ' de 10'}`)}>${v.q2 < 0 ? '–' : v.q2}</span>`;
function tarjeta(v, marcar = '') {
  let t = esc(v.texto);
  if (marcar) t = t.replace(new RegExp(`(${esc(marcar).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
  const e = V.estudio[v.r[DI.estudio]];
  return `<article class="voz" tabindex="0"><q>${t}</q><div class="m">${chipNota(v)}
    <span><i class="punto" style="background:${CE[e]}"></i> ${esc(e)} · ${mesC(PERIODOS[v.r[0]])}</span><span class="mc" title="${esc(V.marcacion[v.r[DI.marcacion]])}">${esc(V.marcacion[v.r[DI.marcacion]])}</span></div></article>`;
}
const carEst = {};
function carrusel(id, lentes) {
  const e = carEst[id] ||= {lente: lentes[0]};
  const ej = ejemplos(e.lente);
  const cards = ej == null ? Array(5).fill('<div class="esqueleto" aria-hidden="true"></div>').join('') :
    ej.items.length ? ej.items.map(v => tarjeta(v)).join('') : '<p class="vacio">Sin comentarios con estos filtros</p>';
  return `<section class="panel" data-car="${id}" data-lentes="${lentes.join('|')}"><header><h2>Lo que dicen los clientes <span class="nota" style="font-weight:600;margin-left:6px" ${tipAttr('Ejemplos variados por marcación, con los filtros actuales. Clic en una tarjeta para leerla completa. Datos personales tapados.')}>${ej ? `${f0(ej.total)} comentarios · ${ej.items.length} ejemplos` : 'cargando…'}</span></h2>
      <div class="seg" role="group" aria-label="Tipo de comentario">${lentes.map(l => `<button type="button" data-lente="${l}" aria-pressed="${e.lente === l}">${LENTES[l].t}</button>`).join('')}</div>
</header>
    <div class="voces"><button type="button" class="flecha izq" aria-label="Anteriores">${svgI('izq')}</button><div class="riel-v">${cards}</div><button type="button" class="flecha der" aria-label="Siguientes">${svgI('der')}</button></div></section>`;
}
// Repinta solo los carruseles (al llegar comentarios.js o al cambiar de lente), sin volver a animar el resto
function repintarCarruseles(raiz) {
  raiz.querySelectorAll('[data-car]').forEach(s => { s.outerHTML = carrusel(s.dataset.car, s.dataset.lentes.split('|')); });
  montarCarrusel(raiz);
}
function montarCarrusel(raiz) {
  raiz.querySelectorAll('[data-car]').forEach(p => {
    p.querySelectorAll('[data-lente]').forEach(b => b.onclick = () => { carEst[p.dataset.car].lente = b.dataset.lente; repintarCarruseles(p.parentNode); });
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
// Gráficos animados (graficos.js; anima con vendor/motion.js si está, si no queda el estado final)
const G = window.GRAF;
G.config({tip: tipAttr});
const tipInd = (k, r, extra = '') => r == null ? 'Sin respuestas válidas' :
  `<div class="t">${IND[k].nombre}: ${fmt(k, r)}</div>n = ${f0(r.n)} · IC 95 % ±${f1(r.ic)} ${k === 'nps' ? 'pts' : 'pp'}${r.n < NMIN ? '<br><b>Muestra baja</b>: lectura indicativa' : ''}${extra}`;
const bajo = r => r && r.n < NMIN ? ' <span class="bajo">muestra baja</span>' : '';

// ------------------------------------------------------------------ barra superior
const ctrl = document.getElementById('ctrl'), barF = document.getElementById('filtros');
function pintarCtrl() {
  ctrl.innerHTML = `
    <div class="mes-f" id="f-per"><button type="button" class="sel" aria-haspopup="true" aria-expanded="false" title="Elegir uno o varios meses">${etqMeses(st.meses)}${st.meses.length > 1 ? ` <b>· ${st.meses.length} meses</b>` : ''}</button>
      <div class="pop" hidden role="group" aria-label="Meses"><div class="atajos"><button type="button" data-m="ult">Solo el último</button><button type="button" data-m="todos">Todos</button></div>
        ${PERIODOS.map((p, i) => i).reverse().map(i => `<label class="op"><input type="checkbox" value="${i}"${st.meses.includes(i) ? ' checked' : ''}><span>${mesL(PERIODOS[i])}</span><small>${f0(D.periodos[PERIODOS[i]].n)}</small></label>`).join('')}
        <p class="nota" style="margin:6px 8px 2px">Con varios meses, las cifras suman todas sus encuestas y se comparan con los mismos meses justo antes.</p></div></div>
    <div class="seg" role="group" aria-label="Estudio" id="f-est"><button type="button" data-v="" aria-pressed="${st.estudio == null}">Todos</button>${EST.map((e, i) => `<button type="button" data-v="${i}" aria-pressed="${st.estudio === i}"><i style="background:${CE[e]}"></i>${e}</button>`).join('')}</div>`;
  const fp_ = ctrl.querySelector('#f-per'), bp = fp_.querySelector('button.sel'), pp = fp_.querySelector('.pop');
  bp.onclick = e => { e.stopPropagation(); const si = pp.hidden; document.querySelectorAll('.pop:not([hidden])').forEach(x => { x.hidden = true; }); pp.hidden = !si; bp.setAttribute('aria-expanded', si); };
  fp_.addEventListener('keydown', e => { if (e.key === 'Escape') { pp.hidden = true; bp.setAttribute('aria-expanded', false); bp.focus(); } });
  pp.querySelectorAll('input[type=checkbox]').forEach(c => { c.onchange = () => {
    const ms = new Set(st.meses); if (c.checked) ms.add(+c.value); else ms.delete(+c.value);
    if (!ms.size) { c.checked = true; return; }   // siempre queda al menos un mes
    fijarMeses([...ms]); refrescar({mantener: '__mes'}); }; });
  pp.querySelectorAll('[data-m]').forEach(b => { b.onclick = () => { fijarMeses(b.dataset.m === 'ult' ? [PERIODOS.length - 1] : PERIODOS.map((_, i) => i)); refrescar({mantener: '__mes'}); }; });
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
document.addEventListener('click', e => { if (!e.target.closest('.mes-f')) { const mp = document.querySelector('.mes-f .pop'); if (mp && !mp.hidden) { mp.hidden = true; mp.previousElementSibling.setAttribute('aria-expanded', false); } } });
document.addEventListener('click', e => { if (!e.target.closest('.pill-f')) document.querySelectorAll('.pill-f .pop:not([hidden])').forEach(p => { p.hidden = true; p.previousElementSibling.setAttribute('aria-expanded', false); }); });
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
  if (!ant) return `<span class="nota">${st.meses.length > 1 ? 'sin un periodo anterior igual para comparar' : 'sin mes anterior'}</span>`;
  const d = act.v - ant.v, c = Math.abs(d) < .05 ? 'igual' : d > 0 ? 'mejora' : 'empeora';
  return `<span class="delta ${c}" ${tipAttr(`${etq}: ${fmt(k, ant)} · n ${f0(ant.n)}`)}>${c === 'igual' ? '■' : d > 0 ? '▲' : '▼'} ${fpp(d)} ${k === 'nps' ? 'pts' : 'pp'}<span class="sr"> ${c === 'mejora' ? 'mejora' : c === 'empeora' ? 'empeora' : 'igual'}</span></span><span class="nota">vs ${etq}</span>`;
}
// Spark de área por estudio (color de serie), con los meses elegidos marcados
function spark(k) {
  const series = ests().map(e => ({color: CE[EST[e]], pts: serie(k, 'mes', e).map(p => ({i: p.x, v: p.r.v}))})).filter(s => s.pts.length > 1);
  return series.length ? G.spark(series, PERIODOS.length, st.meses, {alto: 40}) : '';
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
    // Curvas con movimiento de graficos.js (G.lineas): trazo con cometa, puntos que aparecen al paso y cifra final en píldora
    G.lineas(el, {id: el.id, xs, etq, marcas: modo === 'mes' ? st.meses : [], min: IND[k].min, max: IND[k].max, nmin: NMIN,
      fmt: v => fmt(k, {v}), series: S.map(sr => ({nombre: sr.e, color: CE[sr.e], pts: sr.pts.map(p => ({x: p.x, v: p.r.v, n: p.r.n}))})),
      tip: x => `<div class="t">${esc(etq(x))}</div>` + S.map(({e, pts}) => { const p = pts.find(p => p.x === x); return p ? `<i style="background:${CE[e]}"></i>${e}: <b>${fmt(k, p.r)}</b> · n ${f0(p.r.n)}${p.r.n < NMIN ? ' (muestra baja)' : ''}` : ''; }).filter(Boolean).join('<br>')});
    if (tabla) tabla.innerHTML = `<table class="rk"><thead><tr><th>${modo === 'mes' ? 'Mes' : 'Semana'}</th>${S.map(s => `<th class="num">${s.e}</th><th class="num">n</th>`).join('')}</tr></thead><tbody>${xs.map(x => `<tr><td>${esc(etq(x))}</td>${S.map(s => { const p = s.pts.find(p => p.x === x); return `<td class="num">${p ? fmt(k, p.r) : '—'}</td><td class="num">${p ? f0(p.r.n) : '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  });
}
// Distribuciones (graficos.js): la rampa va de la opción peor (rojo intenso) a la mejor (verde sobrio)
// Q6 facilidad: barras divergentes centradas en «Ni fácil ni difícil»
const divergente = grupos => G.divergente(grupos.map(g => ({nombre: g.nombre, cuentas: [1, 2, 3, 4, 5].map(i => g.a['q6_' + i]),
  fin: `${fmt('ces', IND.ces.calc(g.a))}<small>CES</small>`})), D.q6);
// NPS: waffle de 100 cuadritos (detractores, pasivos, promotores)
const wafNps = grupos => G.waffle(grupos.filter(g => g.a.n).map(g => ({nombre: g.nombre, cuentas: [g.a.det, g.a.n - g.a.det - g.a.prom, g.a.prom],
  fin: `${fmt('nps', IND.nps.calc(g.a))}<small>NPS</small>`})), ['Detractores 0–6', 'Pasivos 7–8', 'Promotores 9–10']);
// Q8 funcionando: donas (no funciona / funciona), en el centro el % que funciona
// El centro ya es el indicador (con un decimal): no se repite debajo
const donasFun = grupos => G.donas(grupos.map(g => ({nombre: g.nombre, cuentas: [g.a.q8_no, g.a.q8_si]})), ['No funciona', 'Funciona'], {centro: 'funciona', dec: 1});
function temas(mapa, nombres, idx) {
  const c = new Map(); for (const i of idx) for (const [t, n] of mapa.get(i) || []) c.set(t, (c.get(t) || 0) + n);
  const o = [...c].map(([t, n]) => ({nombre: nombres[t], c: n})).sort((a, b) => b.c - a.c);
  if (o.length <= 9) return o;
  const r = o.slice(8); return [...o.slice(0, 8), {nombre: `Otros ${r.length} temas`, c: r.reduce((x, y) => x + y.c, 0), cod: true}];
}
const DIM_RK = [['marcacion', 'Marcación'], ['aliado', 'Aliado'], ['region', 'Región'], ['red', 'Red'], ['operacion', 'Operación'], ['estrato', 'Estrato']];
const rkEst = {};
function ranking(id, k, dims = DIM_RK, tope = 10) {
  if (!rkEst[id]) rkEst[id] = {dim: dims[0][0], orden: 'n', todos: false};
  const e = rkEst[id]; e.args = [k, dims, tope];
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
    ${vis.map((x, i) => { const d = tot ? x.r.v - tot.v : 0, b = min < 0 ? `left:${Math.min(X(0), X(x.r.v))}%;width:${Math.abs(X(x.r.v) - X(0))}%` : `left:0;width:${X(x.r.v)}%`;
      // Color: diferencia contra el total (rojo = peor, verde = mejor); gris si la muestra es baja (CSS de .poca)
      const col = x.r.n < NMIN ? '' : `;background:${G.tonoDif(d, min < 0 ? 40 : 20)}`, ori = min < 0 && x.r.v < 0 ? 'r' : 'l';
      return `<tr class="${x.r.n < NMIN ? 'poca' : ''}${fil ? ' clic' : ''}${fil && st[e.dim].has(x.v) ? ' sel' : ''}" ${fil ? `tabindex="0" data-v="${x.v}"` : ''}><td class="nom">${esc(x.nombre)}${bajo(x.r)}</td><td class="num">${f0(x.r.n)}</td><td class="num"><b>${fmt(k, x.r)}</b></td><td class="bar"><div class="mini" ${tipAttr(tipInd(k, x.r))}><b style="${b}${col}" data-an="barra" data-o="${ori}" data-i="${i}"></b>${tot ? `<span class="ref" style="left:${X(tot.v)}%"></span>` : ''}</div></td><td class="num"><span class="dif ${x.r.n < NMIN || Math.abs(d) < .05 ? '' : d > 0 ? 'mejora' : 'empeora'}">${fpp(d)}</span></td></tr>`; }).join('') || '<tr><td colspan="5" class="vacio">Sin datos</td></tr>'}
    </tbody></table></div>${g.length > tope ? `<button type="button" class="mas">${e.todos ? 'Ver menos' : `Ver los ${g.length}`}</button>` : ''}
    <p class="nota" style="margin:6px 0 0">${fil ? 'Clic en una fila para filtrar todo el tablero. ' : ''}Gris = menos de ${NMIN} encuestas (no se ordena por valor).</p></section>`;
}
// Cambiar dimensión, orden o «ver todos» repinta y anima solo ese ranking
function repintarRanking(p) {
  const e = rkEst[p.dataset.rk], nuevo = reemplazar(p, ranking(p.dataset.rk, e.args[0], e.args[1], e.args[2]));
  montarRanking(nuevo.parentNode); G.animar(nuevo, {inmediato: true});
}
function montarRanking(raiz) {
  raiz.querySelectorAll('[data-rk]').forEach(p => {
    const e = rkEst[p.dataset.rk];
    p.querySelectorAll('[data-dim]').forEach(b => b.onclick = () => { e.dim = b.dataset.dim; e.todos = false; repintarRanking(p); });
    p.querySelectorAll('[data-ord]').forEach(b => b.onclick = () => { e.orden = b.dataset.ord; repintarRanking(p); });
    const mas = p.querySelector('.mas'); if (mas) mas.onclick = () => { e.todos = !e.todos; repintarRanking(p); };
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
const dolEst = {rango: 'mes', sel: null, voz: null};   // sel = dolor resaltado; voz = dolor con sus comentarios abiertos
function filasDolor() {
  if (dolEst.rango === 'mes') return filas();
  const anio = PERIODOS[st.periodo].slice(0, 4);   // año corrido hasta el último mes elegido
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
    const cesCon = cesDe(ok, val), cesSin = cesDe(cok - ok, cv - val);
    // cesPts: lo que sube el CES si quienes viven el dolor calificaran como quienes no (sobre quienes responden CES)
    return {k, n, nSin: a.n - n, pct: a.n ? n / a.n * 100 : 0, con, sin, cesCon, cesSin, cesNSin: cv - val, cesPct: cv ? val / cv * 100 : 0,
      pts: con != null && sin != null ? n / a.n * (sin - con) : null,
      cesPts: cesCon != null && cesSin != null ? val / cv * (cesSin - cesCon) : null};
  };
  const todas = DL.claves.map((k, i) => fila(k, s[i]));
  return {tot, alguno: todas.find(x => x.k === 'alguno'), dol: todas.filter(x => x.k !== 'alguno')};
}
// Pista de −100 a 100 (NPS) o de 0 a 100 (CES) con los dos puntos: con el dolor y sin él
function pista(con, sin, min, ref, suf, tip, f = 0) {
  if (con == null || sin == null) return '<div class="pz vacia">—</div>';
  const X = v => (v - min) / (100 - min) * 100, lo = Math.min(con, sin), hi = Math.max(con, sin);
  const etq = v => `${f0(v)}${suf}`;
  return `<div class="pz" ${tipAttr(tip)}><div class="riel">${min < 0 ? '<span class="cero" style="left:50%"></span>' : ''}
    ${ref != null ? `<span class="ref" style="left:${X(ref)}%"></span>` : ''}
    <span class="tramo" style="left:${X(lo)}%;width:${X(hi) - X(lo)}%" data-an="ancho" data-i="${f}"></span>
    <span class="pt sin" style="left:${X(sin)}%" data-an="pop" data-i="${f + 2}"></span><span class="pt con" style="left:${X(con)}%" data-an="pop" data-i="${f}"></span>
    <span class="lbl izq" style="right:${100 - X(lo)}%">${etq(lo)}</span><span class="lbl der" style="left:${X(hi)}%">${etq(hi)}</span></div></div>`;
}
function vDolores() {
  const idx = filasDolor(), {tot, alguno, dol} = calcDolores(idx);
  const rango = dolEst.rango === 'mes' ? etqMeses(st.meses) : `ene a ${MES[+PERIODOS[st.periodo].slice(4) - 1]} ${PERIODOS[st.periodo].slice(0, 4)}`;
  const orden = dol.filter(x => x.n).sort((a, b) => (b.n >= NMIN) - (a.n >= NMIN) || b.pts - a.pts);
  const maxPts = Math.max(1, ...orden.filter(x => x.n >= NMIN).map(x => x.pts));
  const maxCes = Math.max(1, ...orden.filter(x => x.n >= NMIN && x.cesPts != null).map(x => x.cesPts));
  const X = v => (v + 100) / 2, XC = v => v;
  const techo = alguno && alguno.sin != null && alguno.nSin >= NMIN ? alguno.sin : null;
  const techoC = alguno && alguno.cesSin != null && alguno.cesNSin >= NMIN ? alguno.cesSin : null;
  const cab = tot.nps == null ? '' : `
    <div class="dol-hero">
      ${filaHero({nom: 'NPS', hoy: tot.nps, techo, nSin: alguno.nSin, X, min: -100, suf: '', u: 'pts', orden, campo: 'sin', m: '', i: 2})}
      ${tot.ces == null ? '' : filaHero({nom: 'CES', hoy: tot.ces, techo: techoC, nSin: alguno.cesNSin, X: XC, min: 0, suf: ' %', u: 'pp', orden, campo: 'cesSin', m: 'c', i: 3})}
      <p class="dh-pie">${f1(alguno.pct)} % de las encuestas (${f0(alguno.n)} de ${f0(tot.n)}) menciona al menos un dolor. Su NPS es ${f1(alguno.con)}${alguno.cesCon != null ? ` y su CES ${f1(alguno.cesCon)} %` : ''}.</p>
    </div>`;
  const filasH = orden.map((x, i) => {
    const [tit, cita] = DOLOR[x.k], poca = x.n < NMIN, br = x.sin - x.con;
    const tipN = `<div class="t">${esc(tit)}</div>NPS con el dolor: <b>${f1(x.con)}</b> (n ${f0(x.n)})<br>NPS sin el dolor: <b>${f1(x.sin)}</b> (n ${f0(x.nSin)})<br>Brecha: ${f1(br)} pts`;
    const tipC = `<div class="t">CES · ${esc(tit)}</div>Con el dolor: <b>${x.cesCon == null ? '—' : f1(x.cesCon) + ' %'}</b><br>Sin el dolor: <b>${x.cesSin == null ? '—' : f1(x.cesSin) + ' %'}</b>${x.cesCon != null && x.cesSin != null ? `<br>Brecha: ${f1(x.cesSin - x.cesCon)} pp` : ''}`;
    const tipP = `<div class="t">Si este dolor desapareciera</div>Quienes lo viven (${f1(x.pct)} %) pasarían a calificar como quienes no lo viven: el NPS iría de ${f1(tot.nps)} a ${f1(x.sin)}.<br>${f1(x.pct)} % × ${f1(br)} pts de brecha = <b>${fpp(x.pts)} pts</b>`;
    const tipPC = x.cesPts == null ? '' : `<div class="t">Si este dolor desapareciera · CES</div>Quienes lo viven (${f1(x.cesPct)} % de quienes responden CES) pasarían a calificar como quienes no lo viven: el CES iría de ${f1(tot.ces)} % a ${f1(x.cesSin)} %.<br>${f1(x.cesPct)} % × ${f1(x.cesSin - x.cesCon)} pp de brecha = <b>${fpp(x.cesPts)} pp</b>`;
    const sel = dolEst.sel === x.k, voz = dolEst.voz === x.k;
    return `<li class="dol${poca ? ' poca' : ''}${sel ? ' dol-on' : ''}" data-k="${x.k}"${x.sin == null ? '' : ` data-x="${X(x.sin).toFixed(2)}" data-et="${esc(f1(x.sin) + ' sin este dolor')}"`}${x.cesSin == null ? '' : ` data-xc="${XC(x.cesSin).toFixed(2)}" data-etc="${esc(f1(x.cesSin) + ' % sin este dolor')}"`}>
      <span class="rk">${String(i + 1).padStart(2, '0')}</span>
      <div class="qu"><span class="mom">${DL.momentos[x.k]}</span>
        <div class="dol-tt"><button type="button" class="dol-t" aria-pressed="${sel}">${esc(tit)}</button>${botonVoces(x.k, voz)}</div><q>${esc(cita)}</q></div>
      <div class="vive"><b>${G.cuenta(x.pct, 1)} %</b><span>${f0(x.n)} encuestas</span>${poca ? '<span class="bajo">muestra baja</span>' : ''}</div>
      ${pista(x.con, x.sin, -100, tot.nps, '', tipN, i)}
      ${pista(x.cesCon, x.cesSin, 0, tot.ces, ' %', tipC, i + 1)}
      <div class="gana" ${tipAttr(tipP)}><b>${x.pts == null ? '—' : G.cuenta(x.pts, 1, {signo: true})}</b><small>pts</small><span class="barrita"><i style="width:${poca || x.pts == null ? 0 : Math.max(0, x.pts) / maxPts * 100}%" data-an="ancho" data-i="${i + 3}"></i></span></div>
      <div class="gana ces"${tipPC ? ' ' + tipAttr(tipPC) : ''}><b>${x.cesPts == null ? '—' : G.cuenta(x.cesPts, 1, {signo: true})}</b><small>pp</small><span class="barrita"><i style="width:${poca || x.cesPts == null ? 0 : Math.max(0, x.cesPts) / maxCes * 100}%" data-an="ancho" data-i="${i + 4}"></i></span></div>
      ${voz ? vocesDolor(x.k) : ''}
    </li>`;
  }).join('');
  return `<section class="panel dolores" id="dolores"><header><h2>Dolores del cliente</h2>
      <div class="herr"><div class="seg" role="group" aria-label="Periodo de los dolores" id="dol-r"><button type="button" data-r="mes" aria-pressed="${dolEst.rango === 'mes'}">${st.meses.length > 1 ? 'Meses elegidos' : 'Mes'}</button><button type="button" data-r="acum" aria-pressed="${dolEst.rango === 'acum'}">Año corrido</button></div></div>
      <p class="sub">${alcance()} · ${rango}. Lo que cuentan los clientes en sus comentarios, cruzado con lo que responden de NPS y CES. Arriba, el dolor que más puntos de NPS le quita a la nota; al lado, lo que recuperaría el CES.</p></header>
    ${cab}
    ${leyendaDolores('Lo vive', 'NPS', 'CES', 'NPS que recupera', 'CES que recupera')}
    <ol class="dol-lista${dolEst.sel && orden.some(x => x.k === dolEst.sel) ? ' con-sel' : ''}">${filasH || '<li class="vacio">Sin encuestas con estos filtros</li>'}</ol>
    <p class="nota dol-nota">Cada dolor sale de los comentarios (Q3, Q13, Q7 y Q10) con las mismas reglas de los análisis de dolores de Soporte y Fallas masivas. «La falla sigue» suma además a quien responde que su servicio no funciona (Q8). Clic en un dolor para resaltarlo y en el globo para leer lo que más repiten quienes lo viven. Los puntos son teóricos: suponen que quien deja de vivir el dolor califica igual que quien nunca lo vivió. Como un cliente puede tener varios dolores, los puntos de las filas no se suman; el número de arriba cuenta cada encuesta una sola vez.</p>
  </section>`;
}

// ------------------------------------------------------------------ dolores: resaltar uno y leer lo que más repiten
// Encabezado de la lista: el nombre del indicador grande y debajo la clave de los puntos, centrado sobre su columna
const pareja = (c, t) => `<span><i class="pt ${c}"></i>${t}</span>`;
const leyendaDolores = (vive, n1, n2, recupera, recupera2) => {
  const pts = `<small>${pareja('con', 'Con el dolor')}${pareja('sin', 'Sin el dolor')}<span><i class="ref"></i>Total</span></small>`;
  return `<div class="dol-ley" aria-hidden="true"><span></span><span class="dl-t"><b>${vive}</b><small>de las encuestas</small></span>
    <span class="dl-t"><b>${n1}</b>${pts}</span><span class="dl-t"><b>${n2}</b>${pts}</span><span class="dl-t"><b>${recupera}</b><small>si el dolor desaparece</small></span><span class="dl-t"><b>${recupera2}</b><small>si el dolor desaparece</small></span></div>`;
};
// Una fila del recuadro de arriba (NPS o CES): hoy → sin ningún dolor, y los puntos en juego. m = sufijo de data-x/data-et del dolor
function filaHero({nom, hoy, techo, nSin, X, min, suf, u, orden, campo, m, i}) {
  const tip = `<div class="t">Techo teórico · ${nom}</div>Las ${f0(nSin)} encuestas que no mencionan ningún dolor dan un ${nom} de ${techo == null ? '—' : f1(techo) + suf}. Si todos calificaran así, el ${nom} subiría ${techo == null ? '—' : f1(techo - hoy)} ${u}.`;
  return `<div class="dh-fila">
      <div class="dh-num"><span>${nom} hoy</span><b>${G.cuenta(hoy, 1)}${suf}</b></div>
      <div class="dh-pista" data-m="${m}" ${tipAttr(tip)}>
        <div class="riel">${min < 0 ? '<span class="cero" style="left:50%"></span>' : ''}
          ${techo == null ? '' : `<span class="flujo" style="left:${X(Math.min(hoy, techo))}%;width:${Math.abs(X(techo) - X(hoy))}%" data-an="ancho" data-i="${i}"></span><span class="pt fin" style="left:${X(techo)}%" data-an="desliza" data-desde="${X(hoy)}%" data-i="${i}"></span>`}
          <span class="pt hoy" style="left:${X(hoy)}%"></span>${marcaElegido(orden, X, campo, suf)}</div>
        <div class="escala"><span>${min < 0 ? '−100' : '0'}</span><span>${min < 0 ? '0' : '50'}</span><span>100</span></div></div>
      <div class="dh-num der"><span>Sin ningún dolor</span><b>${techo == null ? '—' : G.cuenta(techo, 1, {desde: hoy}) + suf}</b></div>
      <div class="dh-pts"><b>${techo == null ? '—' : G.cuenta(techo - hoy, 1, {signo: true})}</b><span>${u} de ${nom} en juego</span></div>
    </div>`;
}
const ICO_VOZ = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7.5a2.5 2.5 0 0 1-2.5 2.5H10.5L6.6 19.7c-.5.4-1.1 0-1.1-.6v-2.6A2.5 2.5 0 0 1 4 14z"/><path d="M8.5 9h7M8.5 12.2h4.5"/></svg>';
const botonVoces = (k, abierto) => `<button type="button" class="dol-com" aria-expanded="${abierto}" aria-label="Ver lo que más repiten quienes viven «${esc(DOLOR[k][0])}»" ${tipAttr('Lo que más repiten quienes viven este dolor')}>${ICO_VOZ}</button>`;
// Punto del dolor elegido sobre el riel del recuadro de arriba: hasta dónde llegaría el NPS sin ese dolor
function marcaElegido(orden, X, campo = 'sin', suf = '') {
  const x = dolEst.sel ? orden.find(d => d.k === dolEst.sel) : null, ok = x && x[campo] != null;
  return `<span class="pt elegido" style="left:${ok ? X(x[campo]) : 50}%"${ok ? '' : ' hidden'}></span><span class="elegido-et" style="left:${ok ? X(x[campo]) : 50}%"${ok ? '' : ' hidden'}>${ok ? esc(f1(x[campo]) + suf + ' sin este dolor') : ''}</span>`;
}
// Comentarios de quienes viven el dolor k (el comentario lo menciona), con los filtros y el periodo de la caja de dolores
function comDolor(k) {
  if (!C) return null;
  const bit = DLC.indexOf(k);
  if (bit < 0) return [];
  const acum = dolEst.rango !== 'mes', anio = PERIODOS[st.periodo].slice(0, 4);
  return C.filter(v => (v.dl >> bit) & 1 && util(v) && pasa(v.r, acum ? {periodo: null} : {}) && (!acum || (PERIODOS[v.r[0]].slice(0, 4) === anio && v.r[0] <= st.periodo)));
}
const recortar = (t, n) => t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + '…' : t;
// Lo que más repiten: palabras más frecuentes y comentarios agrupados (los casi iguales juntos), primero los que más se repiten
function vocesDolor(k) {
  const items = comDolor(k), tit = DOLOR[k][0];
  if (items == null) return '<div class="dol-voces"><p class="nota">Cargando comentarios…</p></div>';
  if (!items.length) return `<div class="dol-voces"><p class="nota">Sin comentarios que mencionen «${esc(tit)}» con estos filtros.</p></div>`;
  const an = NUBE.analizar(items, NUBE_CFG), gr = NUBE.similares(items, null, NUBE_CFG, {df: an.df, max: 5}).grupos;
  const pal = an.palabras.slice(0, 8);
  return `<div class="dol-voces" role="region" aria-label="Lo que más repiten quienes viven ${esc(tit)}">
    <div class="dv-cab"><b>Lo que más repiten</b><span class="nota">${f0(items.length)} ${items.length === 1 ? 'comentario menciona' : 'comentarios mencionan'} este dolor · los casi iguales van juntos</span></div>
    ${pal.length ? `<div class="dv-pal" aria-label="Palabras que más se repiten">${pal.map(w => `<span>${esc(w.t)}<small>${f0(w.n)}</small></span>`).join('')}</div>` : ''}
    <ol class="dv-lista">${gr.map(g => { const v = g.rep.v, n = g.miembros.length;
      return `<li>${chipNota(v)}<q>${esc(recortar(v.texto, 300))}</q>${n > 1 ? `<span class="dv-rep" ${tipAttr(f0(n) + ' comentarios casi iguales')}>×${n}</span>` : '<span></span>'}<div class="dv-meta">${metaCom(v)}</div></li>`; }).join('')}</ol>
  </div>`;
}
const anima = () => G.activo() && window.Motion;
function pintarSel(sec, anim) {
  const lista = sec.querySelector('.dol-lista'); if (!lista) return;
  lista.classList.toggle('con-sel', !!dolEst.sel);
  sec.querySelectorAll('.dol[data-k]').forEach(li => {
    const on = li.dataset.k === dolEst.sel;
    li.classList.toggle('dol-on', on); li.querySelector('.dol-t').setAttribute('aria-pressed', on);
    if (on && anim && anima()) Motion.animate(li, {scale: [.98, 1]}, {type: 'spring', bounce: .45, duration: .5});
  });
  const li = dolEst.sel ? sec.querySelector(`.dol[data-k="${dolEst.sel}"]`) : null;
  // Un marcador por riel del recuadro de arriba: NPS lee data-x/data-et del dolor, CES data-xc/data-etc
  sec.querySelectorAll('.dh-pista').forEach(p => {
    const m = p.querySelector('.elegido'), et = p.querySelector('.elegido-et'), c = p.dataset.m || '';
    if (!m || !et) return;
    if (li && li.dataset['x' + c]) {
      const nuevo = m.hidden;
      m.hidden = et.hidden = false; m.style.left = et.style.left = li.dataset['x' + c] + '%'; et.textContent = li.dataset['et' + c];
      // WAAPI y no Motion: el marcador ya lleva translate(-50%) y Motion reemplazaría todo el transform
      if (nuevo && anim && anima()) {
        m.animate([{transform: 'translate(-50%,-50%) scale(0)'}, {transform: 'translate(-50%,-50%) scale(1)'}], {duration: 480, easing: 'cubic-bezier(.34,1.56,.64,1)'});
        et.animate([{opacity: 0, transform: 'translate(-50%,6px)'}, {opacity: 1, transform: 'translate(-50%,0)'}], {duration: 300, easing: 'ease-out'});
      }
    } else m.hidden = et.hidden = true;
  });
}
function ponerVoces(sec, anim) {
  const k = dolEst.voz; if (!k) return;
  const li = sec.querySelector(`.dol[data-k="${k}"]`);
  if (!li) { dolEst.voz = null; return; }
  li.querySelectorAll('.dol-voces').forEach(x => x.remove());
  li.insertAdjacentHTML('beforeend', vocesDolor(k));
  li.querySelector('.dol-com').setAttribute('aria-expanded', 'true');
  const caja = li.querySelector('.dol-voces');
  if (anim && anima()) {
    Motion.animate(caja, {opacity: [0, 1], y: [-8, 0]}, {duration: .35, ease: [.22, 1, .36, 1]});
    Motion.animate(caja.querySelectorAll('.dv-pal span, .dv-lista li'), {opacity: [0, 1], y: [8, 0]}, {duration: .35, delay: Motion.stagger(.035, {startDelay: .08})});
  }
}
function abrirVoces(sec, k) {
  const cerrar = dolEst.voz === k;
  sec.querySelectorAll('.dol-voces').forEach(x => x.remove());
  sec.querySelectorAll('.dol-com').forEach(b => b.setAttribute('aria-expanded', 'false'));
  dolEst.voz = cerrar ? null : k;
  if (cerrar) return;
  dolEst.sel = k; pintarSel(sec, true); ponerVoces(sec, true);
  if (!C) cargarComentarios();
}
function montarDolSel(raiz) {
  const sec = raiz.querySelector('#dolores'); if (!sec) return;
  sec.querySelectorAll('.dol[data-k]').forEach(li => {
    const k = li.dataset.k, elegir = () => { dolEst.sel = dolEst.sel === k ? null : k; pintarSel(sec, true); };
    li.onclick = e => { if (!e.target.closest('.dol-com, .dol-voces, .dol-t')) elegir(); };
    li.querySelector('.dol-t').onclick = elegir;
    li.querySelector('.dol-com').onclick = () => abrirVoces(sec, k);
  });
}

// ------------------------------------------------------------------ correlación con el NPS
// Pearson entre la nota del indicador y la recomendación 0–10 (Q2), encuesta por encuesta
function corr(k, a) {
  const n = a['r_' + k + '_n'];
  if (n == null || n < NMIN) return null;
  const mx = a['r_' + k + '_x'] / n, my = a['r_' + k + '_y'] / n;
  const vx = a['r_' + k + '_xx'] / n - mx * mx, vy = a['r_' + k + '_yy'] / n - my * my, cv = a['r_' + k + '_xy'] / n - mx * my;
  return vx > 0 && vy > 0 ? {r: cv / Math.sqrt(vx * vy), n} : null;
}
// Fuerza: verde ≥ 0,5 (fuerte), amarillo 0,3–0,5 (moderada), rojo < 0,3 (baja)
const fuerza = r => Math.abs(r) >= .5 ? 'fuerte' : Math.abs(r) >= .3 ? 'moderada' : 'baja';
const nf2 = new Intl.NumberFormat('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const NOTA_CORR = {ces: 'la facilidad (Q6, 1 a 5)', fun: 'si el servicio funciona (Q8, sí o no)', ase: 'la calificación del asesor (los 4 atributos de Q9; solo quien calificó los 4)'};
function corrTxt(k, a) {
  const c = corr(k, a);
  if (!c) return ` · <span class="corr na" ${tipAttr('<div class="t">Correlación con el NPS</div>Menos de ' + NMIN + ' encuestas con ambas respuestas: no se calcula.')}>—</span>`;
  const v = nf2.format(c.r).replace('-', '−'), f = fuerza(c.r);
  return ` · <span class="corr ${f}" ${tipAttr(`<div class="t">Correlación con el NPS: ${v} (${f})</div>Pearson entre ${NOTA_CORR[k]} y la recomendación de 0 a 10, encuesta por encuesta (${f0(c.n)} pares, con los filtros actuales).<br>Verde ≥ 0,50 fuerte · amarillo 0,30 a 0,49 moderada · rojo < 0,30 baja.<br>${c.r >= .3 ? 'Quien califica mejor este punto tiende a recomendar más.' : 'Este punto se mueve poco junto con la recomendación.'} Correlación no es causa.`)}><span class="sr">Correlación con el NPS, ${f}: </span>${v}</span>`;
}

// ------------------------------------------------------------------ alarmas (Resumen)
// Por estudio (el del filtro o los dos) e indicador, con los meses y filtros actuales. Una diferencia cuenta solo si sale
// del margen de error al 95 % de las dos cifras juntas: √(ic₁² + ic₂²). Reglas:
//  · alta  · el indicador cae frente al periodo anterior; un segmento (n ≥ 30 en ambos) cae frente al periodo anterior
//  · media · tres meses seguidos bajando o el valor más bajo de la serie (con un solo mes elegido); un segmento queda por
//            debajo del total del estudio; un dolor sube
//  · bien  · el indicador mejora frente al periodo anterior
// Segmentos y dolores: se muestran los 3 de más peso por estudio (n × diferencia, en proporción a la escala del indicador).
const DIM_AL = [['region', 'Región'], ['red', 'Red'], ['aliado', 'Aliado'], ['marcacion', 'Marcación'], ['operacion', 'Operación']];   // MULTI: «Filtrar» usa alternar()
const NIVEL_AL = {alta: 0, media: 1, bien: 2};
const alEst = {todos: false};
const margen = (a, b) => Math.hypot(a.ic, b.ic);
const unid = k => k === 'nps' ? 'pts' : 'pp';
const ESC = k => IND[k].max - IND[k].min;
// Volumen de encuestas: promedio mensual de los meses elegidos frente al promedio histórico de los demás meses (con los mismos
// filtros). Si el mes elegido es el último y está en curso, se proyecta al mes completo (n × días del mes / días corridos).
// Alarma si la diferencia pasa de ±25 %; crítica si hay 50 % o más de encuestas de menos (la lectura pierde respaldo).
const UMBRAL_VOL = .25;
function mesParcial() {
  const g = D.generado, ult = PERIODOS[PERIODOS.length - 1];
  if (g.slice(0, 4) + g.slice(5, 7) !== ult) return null;
  const dia = +g.slice(8, 10), dias = new Date(+ult.slice(0, 4), +ult.slice(4), 0).getDate();
  return dia < dias ? {dia, dias, factor: dias / dia} : null;
}
function volumen(e) {
  const porP = new Map(porDim(filas({estudio: e, periodo: null}), 'periodo').map(g => [g.v, g.a.n]));
  const ult = PERIODOS.length - 1, par = mesParcial();
  const hist = [...porP.keys()].filter(i => !st.meses.includes(i) && !(i === ult && par));
  if (hist.length < 3) return null;
  const prom = hist.reduce((t, i) => t + porP.get(i), 0) / hist.length;
  if (prom < NMIN) return null;
  const proy = i => (porP.get(i) || 0) * (i === ult && par ? par.factor : 1);
  const real = st.meses.reduce((t, i) => t + (porP.get(i) || 0), 0) / st.meses.length, act = st.meses.reduce((t, i) => t + proy(i), 0) / st.meses.length;
  const rel = act / prom - 1;
  if (Math.abs(rel) < UMBRAL_VOL) return null;
  const proyectado = st.meses.includes(ult) && par, mas = rel > 0;
  return {nivel: !mas && rel <= -.5 ? 'alta' : 'media', e, peso: Math.min(Math.abs(rel), 1) / 2,
    tit: `Encuestas: ${f0(act)}${st.meses.length > 1 ? ' al mes' : ''}, ${f0(Math.abs(rel) * 100)} % ${mas ? 'más' : 'menos'} que el promedio histórico`,
    det: `Promedio de ${hist.length} meses: ${f0(prom)} al mes · ${etqCorta(st.meses)}: ${f0(real)}${proyectado ? ` hasta el ${par.dia}, proyectado al mes completo ${f0(act)}` : ''}${mas ? ' · más encuestas de lo normal: revisa si cambió la muestra o hubo un evento' : ' · con menos encuestas las cifras tienen más margen de error'}`};
}
function alarmas() {
  const out = [], ant = mesesAnteriores(), etA = ant ? etqCorta(ant) : '', etM = etqCorta(st.meses);
  for (const e of ests()) {
    const idx = filas({estudio: e}), a = sumar(idx), idxA = ant ? filas({estudio: e, periodo: ant}) : [], aA = ant ? sumar(idxA) : null;
    const seg = [], dol = [];
    const vol = volumen(e); if (vol) out.push(vol);
    for (const k of KS) {
      const r = IND[k].calc(a), rA = aA ? IND[k].calc(aA) : null;
      if (!r || r.n < NMIN) continue;
      // Total del estudio frente al periodo anterior
      if (rA && rA.n >= NMIN) {
        const d = r.v - rA.v, m = margen(r, rA);
        if (Math.abs(d) > m) out.push({nivel: d < 0 ? 'alta' : 'bien', e, peso: Math.abs(d) / ESC(k),
          tit: `${IND[k].corto} ${d < 0 ? 'cae' : 'sube'} ${f1(Math.abs(d))} ${unid(k)}`,
          det: `${etA} ${fmt(k, rA)} → ${etM} ${fmt(k, r)} · margen ±${f1(m)} · n ${f0(rA.n)} → ${f0(r.n)}`});
      }
      // Racha y mínimo de la serie mensual (solo con un mes elegido)
      if (st.meses.length === 1) {
        const pts = serie(k, 'mes', e).filter(x => x.x <= st.periodo && x.r.n >= NMIN), u = pts.length - 1;
        if (u >= 0 && pts[u].x === st.periodo) {
          const ult4 = pts.slice(-4), racha = ult4.length === 4 && ult4.every((x, i) => !i || (x.x === ult4[i - 1].x + 1 && x.r.v < ult4[i - 1].r.v));
          const minimo = pts.length >= 6 && pts.slice(0, u).every(x => x.r.v > pts[u].r.v);
          if (racha || minimo) out.push({nivel: 'media', e, peso: 1,
            tit: `${IND[k].corto}: ${[minimo ? `el más bajo desde ${pts[0].et}` : '', racha ? 'tres meses seguidos bajando' : ''].filter(Boolean).join(' y ')}`,
            det: (racha ? ult4 : pts.slice(-4)).map(x => `${x.et} ${fmt(k, x.r)}`).join(' → ')});
        }
      }
      // Segmentos: caen frente al periodo anterior o quedan por debajo del total
      for (const [dim, nomDim] of DIM_AL) {
        if (st[dim].size === 1) continue;   // ya filtrado a un solo valor: es el total
        const antD = ant ? new Map(porDim(idxA, dim).map(g => [g.v, IND[k].calc(g.a)])) : new Map();
        for (const g of porDim(idx, dim)) {
          const rs = IND[k].calc(g.a);
          if (!rs || rs.n < NMIN || g.nombre === 'Sin dato') continue;
          const ra = antD.get(g.v), filtro = {dim, v: g.v};
          if (ra && ra.n >= NMIN && rs.v - ra.v < -margen(rs, ra))
            seg.push({nivel: 'alta', e, filtro, clave: dim + g.v, peso: rs.n * (ra.v - rs.v) / ESC(k) / a.n,
              tit: `${nomDim} ${esc(g.nombre)}: ${IND[k].corto} cae ${f1(ra.v - rs.v)} ${unid(k)}`,
              det: `${etA} ${fmt(k, ra)} → ${etM} ${fmt(k, rs)} · n ${f0(ra.n)} → ${f0(rs.n)}`});
          else if (rs.v + rs.ic < r.v)
            seg.push({nivel: 'media', e, filtro, clave: dim + g.v, peso: rs.n * (r.v - rs.v) / ESC(k) / a.n / 2,
              tit: `${nomDim} ${esc(g.nombre)}: ${IND[k].corto} ${f1(r.v - rs.v)} ${unid(k)} bajo el total`,
              det: `${fmt(k, rs)} frente a ${fmt(k, r)} del estudio · n ${f0(rs.n)} (${f0(rs.n / r.n * 100)} %)`});
        }
      }
    }
    // Dolores que suben (proporción de encuestas que lo menciona)
    if (ant && a.n >= NMIN && aA.n >= NMIN) {
      const dAct = calcDolores(idx).dol, dAnt = new Map(calcDolores(idxA).dol.map(x => [x.k, x]));
      for (const x of dAct) {
        const y = dAnt.get(x.k), p1 = x.pct / 100, p0 = y.pct / 100, m = 196 * Math.hypot(Math.sqrt(p1 * (1 - p1) / a.n), Math.sqrt(p0 * (1 - p0) / aA.n));
        if (x.pct - y.pct > m) dol.push({nivel: 'media', e, peso: (x.pct - y.pct) / 100,
          tit: `Dolor en alza: «${esc(DOLOR[x.k][0])}»`,
          det: `Lo menciona el ${f1(y.pct)} % → ${f1(x.pct)} % de las encuestas (+${f1(x.pct - y.pct)} pp) · NPS de quien lo vive ${x.con == null ? '—' : f1(x.con)}`});
      }
    }
    // De cada segmento queda la alarma de más peso; 3 caídas y 3 brechas por estudio
    const unico = new Map();
    for (const x of seg.sort((a, b) => NIVEL_AL[a.nivel] - NIVEL_AL[b.nivel] || b.peso - a.peso)) if (!unico.has(x.clave)) unico.set(x.clave, x);
    const segs = [...unico.values()];
    out.push(...segs.filter(x => x.nivel === 'alta').slice(0, 3), ...segs.filter(x => x.nivel === 'media').slice(0, 3),
      ...dol.sort((a, b) => b.peso - a.peso).slice(0, 3));
  }
  return out.sort((a, b) => NIVEL_AL[a.nivel] - NIVEL_AL[b.nivel] || b.peso - a.peso);
}
function vAlarmas() {
  const al = alarmas(), ant = mesesAnteriores(), per = PERIODOS[st.periodo], tope = 7;
  const cnt = Object.keys(NIVEL_AL).map(n => [n, al.filter(x => x.nivel === n).length]);
  const nomN = {alta: ['crítica', 'críticas'], media: ['a vigilar', 'a vigilar'], bien: ['mejora', 'mejoras']};
  const enCurso = st.periodo === PERIODOS.length - 1 && D.generado.slice(0, 7).replace('-', '') === per;
  const vis = alEst.todos ? al : al.slice(0, tope);
  const reglas = 'Cuenta como alarma solo lo que sale del margen de error al 95 %.<br><b>Crítica</b>: el indicador o un segmento (región, red, aliado, marcación, operación; n ≥ ' + NMIN + ') cae frente al periodo anterior.<br><b>A vigilar</b>: el valor más bajo de la serie o tres meses seguidos bajando (con un solo mes elegido), un segmento por debajo del total del estudio o un dolor que sube.<br><b>Encuestas</b>: más o menos de ±25 % frente al promedio mensual histórico (a vigilar; crítica si hay 50 % o más de menos). El mes en curso se proyecta al mes completo.<br><b>Mejora</b>: el indicador sube frente al periodo anterior.<br>Responde a los filtros: con un estudio elegido muestra solo ese.';
  const li = (x, i) => `<li class="al ${x.nivel}" data-an="aparece" data-i="${i}"><i class="al-p" aria-hidden="true"></i>
      <div class="al-x"><div class="al-t"><span class="al-e" style="--c:${CE[EST[x.e]]}">${EST[x.e] === 'Falla masiva' ? 'FM' : 'Soporte'}</span>${x.tit}</div><p>${x.det}</p></div>
      ${x.filtro ? `<button type="button" class="al-f" data-dim="${x.filtro.dim}" data-v="${x.filtro.v}" aria-pressed="${st[x.filtro.dim].has(x.filtro.v)}">${st[x.filtro.dim].has(x.filtro.v) ? 'Quitar filtro' : 'Filtrar'}</button>` : ''}</li>`;
  return `<section class="panel alarmas${al.length ? ' con' : ''}" id="alarmas"><header><h2 ${tipAttr(reglas)}>Alarmas <span class="info">?</span></h2>
      <div class="al-cont">${cnt.filter(([, n]) => n).map(([nv, n]) => `<span class="al-c ${nv}">${n} ${nomN[nv][n === 1 ? 0 : 1]}</span>`).join('')}</div>
      <p class="sub">${alcance()} · ${etqMeses(st.meses)}${ant ? ` frente a ${etqCorta(ant)}` : ' · sin un periodo anterior igual para comparar'}${enCurso ? ` · mes en curso (corte al ${D.generado.slice(8, 10)}/${D.generado.slice(5, 7)}): las cifras pueden moverse` : ''}</p></header>
    ${al.length ? `<ol class="al-lista">${vis.map(li).join('')}</ol>${al.length > tope ? `<button type="button" class="mas" id="al-mas">${alEst.todos ? 'Ver menos' : `Ver las ${al.length}`}</button>` : ''}`
      : `<p class="al-ok"><b>Sin alarmas.</b> Ningún indicador, segmento ni dolor se movió fuera del margen de error.</p>`}
  </section>`;
}
function montarAlarmas(raiz) {
  raiz.querySelectorAll('#alarmas .al-f').forEach(b => b.onclick = () => alternar(b.dataset.dim, +b.dataset.v));
  const mas = raiz.querySelector('#al-mas');
  if (mas) mas.onclick = () => { alEst.todos = !alEst.todos; const n = reemplazar(document.getElementById('alarmas'), vAlarmas()); montarAlarmas(n); G.animar(n, {inmediato: true}); };
}

// ------------------------------------------------------------------ vistas
function vResumen(p) {
  const a = sumar(filas()), ant = mesesAnteriores(), aAnt = ant ? sumar(filas({periodo: ant})) : null, etA = ant ? etqCorta(ant) : '';
  const kpis = KS.map((k, i) => {
    const r = IND[k].calc(a), pr = aAnt ? IND[k].calc(aAnt) : null;
    // Anillo: dónde cae el valor en su escala (NPS −100 a 100; el resto 0 a 100 %), en la rampa rojo → verde
    return `<article class="kpi${i === 0 ? ' estrella' : ''}">${i === 0 ? '<span class="glow"></span>' : ''}
      ${r ? G.anillo(r.v, IND[k].min, IND[k].max, {tip: tipInd(k, r), tam: i === 0 ? 64 : 56, grosor: i === 0 ? 7 : 6}) : ''}
      <div class="et">${i === 0 ? IND[k].nombre : IND[k].corto} <span class="info" tabindex="0" ${tipAttr(esc(IND[k].def))}>?</span></div>
      <div class="v" ${tipAttr(tipInd(k, r))}>${r ? `${G.cuenta(r.v, 1)}<small>${k === 'nps' ? 'pts' : '%'}</small>` : '—'}</div>
      <div class="pie">${delta(k, r, pr, etA)}</div>
      ${spark(k)}
      <div class="pie"><span>n ${r ? f0(r.n) : 0}${r ? ` · ±${f1(r.ic)}` : ''}${k === 'nps' ? '' : corrTxt(k, a)}</span>${bajo(r)}<button type="button" class="ver" data-cajon="${k}" aria-label="Ver detalle y comentarios de ${IND[k].nombre}">Voces ›</button></div></article>`;
  }).join('');
  p.innerHTML = `
    <section class="kpis" aria-label="Indicadores de ${etqMeses(st.meses)}">${kpis}</section>
    <div class="g g-2-1" style="min-height:0">
      ${panelEvo()}
      ${vAlarmas()}
    </div>
    ${vDolores()}
    ${carrusel('res', ['det', 'pro', 'dif', 'nof', 'amal'])}`;
  montarDolores(p); montarEvo(p); montarAlarmas(p);
}
// Evolución: cambiar indicador o agrupación repinta y anima solo este panel
function panelEvo() {
  return `<section class="panel" id="evo-p"><header><h2>${IND[st.evo].nombre} · ${st.modo === 'mes' ? 'mes a mes' : 'semana a semana, ' + etqMeses(st.meses)}</h2>
        <div class="herr"><div class="seg" role="group" aria-label="Indicador" id="evo-k">${KS.map(k => `<button type="button" data-k="${k}" aria-pressed="${st.evo === k}">${IND[k].corto}</button>`).join('')}</div>
        ${PERIODOS.length > 1 ? `<div class="seg" role="group" aria-label="Agrupar" id="evo-m"><button type="button" data-m="mes" aria-pressed="${st.modo === 'mes'}">Mes</button><button type="button" data-m="semana" aria-pressed="${st.modo === 'semana'}">Semana</button></div>` : ''}</div>
        <div class="leyenda" style="flex-basis:100%">${ests().map(e => `<span><i class="l" style="background:${CE[EST[e]]}"></i>${EST[e]}</span>`).join('')}<span class="nota">Punto hueco = menos de ${NMIN} encuestas</span>${tablaPH('evo')}</div></header>
        ${lineasPH(st.evo, st.modo, 'evo')}</section>`;
}
// Reemplaza un panel por HTML nuevo y devuelve el nodo insertado
function reemplazar(viejo, html) { const tmp = document.createElement('div'); tmp.innerHTML = html; const n = tmp.firstElementChild; viejo.replaceWith(n); return n; }
function repintarEvo() {
  const n = reemplazar(document.getElementById('evo-p'), panelEvo());
  montarEvo(n); dibujarLineas(n); G.animar(n, {inmediato: true});
}
function montarEvo(raiz) {
  raiz.querySelectorAll('#evo-k button').forEach(b => b.onclick = () => { st.evo = b.dataset.k; repintarEvo(); });
  raiz.querySelectorAll('#evo-m button').forEach(b => b.onclick = () => { st.modo = b.dataset.m; repintarEvo(); });
}
function montarDolores(raiz) {
  montarDolSel(raiz.id === 'dolores' ? raiz.parentNode : raiz);
  raiz.querySelectorAll('#dol-r button').forEach(b => b.onclick = () => {
    dolEst.rango = b.dataset.r;
    const n = reemplazar(document.getElementById('dolores'), vDolores()); montarDolores(n); G.animar(n, {inmediato: true});
  });
}
function vFacilidad(p) {
  const idx = filas(), a = sumar(idx);
  const gr = [...ests().map(e => ({nombre: EST[e], a: sumar(filas({estudio: e}))})), ...(st.estudio == null ? [{nombre: 'Total', a}] : [])];
  p.innerHTML = `
    <section class="panel"><header><h2>¿Qué tan fácil fue contactar a un asesor?</h2><p class="sub">Q6 · centrado en «Ni fácil ni difícil»: a la izquierda lo difícil, a la derecha lo fácil.</p></header>${divergente(gr)}</section>
    ${carrusel('fac', ['dif', 'fac'])}
    <div class="g g2"><section class="panel" style="align-self:start"><header><h2>Qué fue difícil</h2><p class="sub">Temas de Qualtrics en Q7 · % sobre las ${f0(a.com_q7)} encuestas que escribieron algo.</p></header>${G.paletas(temas(TD, D.temas.dificil, idx), a.com_q7)}</section>${ranking('ces', 'ces')}</div>`;
}
function vResolucion(p) {
  const idx = filas(), gr = [...ests().map(e => ({nombre: EST[e], a: sumar(filas({estudio: e}))})), ...(st.estudio == null ? [{nombre: 'Total', a: sumar(idx)}] : [])];
  // NPS de quien dice que funciona frente a quien dice que no (Q8)
  const br = G.brecha(gr.map(g => { const a = g.a;
    return {nombre: g.nombre, sub: `${fmt('fun', IND.fun.calc(a))} funciona`,
      bueno: a.q8_si ? {v: (a.prom_si - a.det_si) / a.q8_si * 100, n: a.q8_si} : null,
      malo: a.q8_no ? {v: (a.prom_no - a.det_no) / a.q8_no * 100, n: a.q8_no} : null}; }),
    {etqBueno: 'Funciona', etqMalo: 'No funciona', unidad: 'pts de NPS'});
  p.innerHTML = `
    <div class="g g2"><section class="panel res-br"><header><h2>¿Quedó funcionando el servicio?</h2><p class="sub">Q8 · NPS de quienes dicen que funciona frente a quienes dicen que no.</p></header>${br}</section>
      <section class="panel comp"><header><h2>Composición</h2><p class="sub">Arriba, si el servicio quedó funcionando (Q8). Abajo, cómo recomiendan (Q2): cada cuadrito es 1 % de las encuestas.</p></header>
        <div class="comp-b"><h3>¿Funciona?</h3>${donasFun(gr)}</div><div class="comp-b"><h3>NPS</h3>${wafNps(gr)}</div></section></div>
    ${carrusel('resol', ['nof', 'sif'])}
    <div class="g g2">${ranking('fun', 'fun')}${ranking('nps', 'nps')}</div>`;
}
function vAsesor(p) {
  const gr = ests().map(e => ({e: EST[e], a: sumar(filas({estudio: e}))}));
  // Relojes: un anillo por estudio (exterior = el primero); el color del arco va de rojo (0 %) a verde (100 %)
  const q9 = G.relojes(D.q9.map((nom, j) => { const q = `q9_${j + 1}`;
    return {nombre: nom, series: gr.map(g => ({e: g.e, color: CE[g.e], r: prop(g.a[q + '_top2'], g.a[q + '_val'])}))}; }));
  p.innerHTML = `
    <div class="g g-1-2"><section class="panel"><header><h2>Desempeño del asesor</h2><div class="leyenda">${gr.map(g => `<span><i style="background:${CE[g.e]}"></i>${g.e}</span>`).join('')}</div><p class="sub">Q9 · % que califica 4 o 5 cada atributo. El punto de color marca el anillo de cada estudio.</p></header>${q9}</section>
      ${ranking('ase', 'ase', [['aliado', 'Aliado'], ['operacion', 'Operación'], ['marcacion', 'Marcación'], ['region', 'Región']])}</div>
    ${carrusel('ase', ['amal', 'abien'])}`;
}
// ------------------------------------------------------------------ nube de comentarios (Voces)
// Temas y limpieza de palabras preparados sobre los 25.261 comentarios ene–oct 2026 (cubren el 82,5 %). Las expresiones van sobre
// el texto normalizado (minúsculas, sin tildes), sin bandera g. Parten de etl/dolores.py, pero aquí se marca cada comentario y
// allá la encuesta: los porcentajes no son comparables uno a uno.
const NUBE_CFG = (() => {
  const cats = [
    ["resuelve", "Falla sin resolver", "\\b(no|ni|nunca|nadie|sin|ningun|ninguna|ninguno|nada|tampoco|jamas)\\b[^.!?]{0,30}(solu|soluc|silu|salu|aolu|solicion|resolv|resuel|arregl|repar|compon|respuesta)|(sigue|sigo|siguen|seguimos|sigua|continua|continuo|continuan|persiste|persisten|aun|todavia|se mantiene)[^.!?]{0,30}(fall|sin |problema|igual|mism|mal|dan|presentand|inconvenien|lent|intermit|pesim)|(falla|problema|dano|inconveniente|error)s? (sigue|siguen|continua|continuan|persiste|persisten|aun)|persist|perciste|a medias|momentane|por un momento|nada que (sirve|funciona|ver|hacer)|sigue igual|igual que antes|no (se )?(mejor|sirvio|hacen nada|hicieron nada|hizo nada|ayudaron|ayudan)|no quedo (funcionando|bien|solucionad|arreglad|resuelt)|cerr(aron|ado|aban) (el|la|los) (caso|ticket|solicitud|incidente|reporte)|dieron por (solucionad|cerrad|resuelt)|\\b(den|dar|dando|dieran|brinden|brindar|brindando|ofrezcan|ofrecer|ofreciendo|busquen|buscar|buscando|buscandole|tengan|encontrar|aporten|necesito|necesitamos|requiero|quiero|queremos|espero|esperamos|exijo|solicito|pido|hagan|haga|se haga)\\b[^.!?]{0,20}(solu|soluc|silu|salu|aolu|solicion|resolv|resuel|arregl|repar|compon|respuesta)|\\bque (me |nos |le |les |lo |la |se |realmente |si |de verdad )*(solucionen|solucione|resuelvan|resuelva|arreglen|arregle|reparen|repare)\\b|(solucionando|resolviendo|arreglando)( de verdad| realmente| de fondo)? (el|los|la|las|mi|nuestro|su|sus) (problema|falla|dano|inconveniente|servicio)|solucion(es)? (real|reales|definitiva|definitivas|de fondo|efectiva|efectivas|concreta|concretas|oportuna)"],
    ["servicio", "Internet y TV fallan", "intermit|se (cae|caia|cayo|va|iba|fue|desconecta|corta|cortaba|pierde|perdia) (el |la |mucho |constantemente |a cada rato |cada rato |seguido )?(internet|senal|servicio|wifi|conexion|red|tv|television|luz|canales|cable)|caidas?\\b|cayendo|(internet|servicio|senal|conexion|navegacion|red|wifi) (es |esta |estaba |muy |super |demasiado |sigue |demasiado )*lent|\\blento\\b|lentitud|velocidad|megas|\\bmb\\b|pixel|congel|inestab|cortes? (de|del|en|constantes)|baja (senal|velocidad)|fluctua|sin (el |los |la |las |ningun |nada de )?(servicio|internet|senal|tv|television|wifi|conexion|telefono fijo|telefonia|canales|cable|datos|red|fijo)|no (tengo|tenemos|hay|habia|tenia|teniamos|tiene|llega|llegaba|he tenido|hemos tenido|cuento con|contamos con) (el |la |los |nada de |ningun |ni )?(servicio|internet|senal|tv|television|wifi|conexion|canales|red|telefono fijo)|no (funciona|funcionaba|funcionan|funcionaron|sirve|servia|sirven|carga|cargan|conecta|navega|navego|enciende|prende)|no (me |nos )?(funciona|sirve)|deja de funcionar|dejo de funcionar|wi ?fi|\\bcanales?\\b|television|\\btv\\b|decodificador|\\bdecos?\\b|senal|cobertura|conexion|desconect|\\bmodem|\\bmoden|router|repetidor|fibra|plataforma|netflix|clarobox|claro video|internet|\\bred\\b|5g|2[.,]4|telefono fijo|linea fija"],
    ["tiempo", "Tiempos y demoras", "\\b(\\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|varios|varias|muchos|muchas|mas de \\w+) (dias|dia|semanas|semana|mes|meses|horas|hora|hrs|minutos|min)\\b|todo el dia|toda la (noche|semana|tarde|manana)|fin de semana|desde (el|hace|ayer|anoche|ese|la semana|el mes)|hace (\\w+ )?(dias|semanas|meses)|demor|tard(o|aron|an|aban|aba|anza|a mucho|isimo)\\b|mucho tiempo|tanto tiempo|tiempo|rapid|agil|oportun|pronto|pronta|inmediat|urgen|promet|cumpl|pactad|quedaron (en|de)|dijeron que (en|iba|ib|seria|a las|ya|maximo|quedaba)|iban a|plazo|esperando|espera\\b|esperar"],
    ["visita", "Técnico y visita", "(^|[^a-z ]|\\b(?!soporte |area |problemas? |fallas? |asesor |asesores |apoyo |departamento |linea |conocimiento |conocimientos |ayuda |atencion |orientaciones |informacion )[a-z]+ )tecnic|visita|\\bcitas?\\b|agend|instalador|cuadrilla|operario|domicili|reprogram|presencial|(no|nunca|ni siquiera|nadie|jamas) (\\w+ )?(llego|llegaron|vino|vinieron|fue nadie|aparecio|aparecieron|se present|asistio|asistieron|ha venido|han venido|ha llegado|han llegado|a llegado|han ido|ha ido|fueron|vienen)\\b"],
    ["contacto", "Contactar a un asesor", "\\bivr\\b|\\bia\\b|inteligencia artificial|conmutador|\\bmenu|marcar|marque|grabacion|robot|\\bbots?\\b|\\bboot|chatbot|maquina|contest|(no|nadie) (me |nos |le )?(atiend|atendi|respond)|atiendan|comunicar|comunico|comunique|comunicarse|comunicacion (con|telefonica|por)|dificil (la )?comunicacion|contactar|contactarse|contactarme|contactarlos|contacto (con|directo|telefonico)|me contacte|hablar con|habla con|llamad|\\bllam(e|o|ar|amos|an|aron|ando|aba|aban|en|o)\\b|en espera|tiempo de espera|minutos (en|de) (espera|linea|la linea|llamada)|colg|cuelg|se (cae|cayo|corta|corto|cortaba) la (llamada|comunicacion)|cort(o|aron|an|aban) la (llamada|comunicacion)|(por|al|via|x|del) (telefono|cel|celular)|telefonic|(la|una|en|esa|esta|por) linea (de|telefonica|\\d|\\*)|lineas? de atencion|\\b611\\b|\\bchat|whats|wasap|wpp|watsap|whasap|guasap|wsp|transfier|transfer|pasan de|pasaron de|de un lado (a|para|al) otro|de asesor en asesor|de area en area|de persona en persona|pelote|lo pasean|repetir|volver a explicar|oficina|punto (fisico|de atencion)|centros? de atencion|\\bapp\\b|aplicacion|canal(es)? de atencion|medios? de (atencion|contacto|comunicacion)|asesor (humano|real|virtual)|persona (real|humana)"],
    ["asesor", "Trato y saber del asesor", "amabl|cordial|respetu|irrespet|(con|sin|mas|el) respeto|groser|mala gana|actitud|prepotent|despota|displicent|\\btrato\\b|trataron|tratan|empatia|empatic|paciencia|escuch|educad|capacit|preparad|conocimiento|conocen|desconoc|idone|no (sabe|saben|sabia|sabian|supo|supieron|tienen idea|tenia idea)\\b|nadie sabe|guion|libreto|automata|reinici(ar|e|en|o|ando|aron|os|amos)\\b|apag(ar|ue|a|o|en|uen) y (prend|encend)|desconect(ar|e|o|en) y (conect|volv)|mentir|mienten|mentira|mentiros|\\bengan|evasiv|evad|excusa|disposicion|atent[oa]s?\\b|desinteres|no (les |le )?(interesa|importa)|profesional|(buena|mala|pesima|excelente|la|su|muy buena|muy mala|mejor|mejorar la|mas) atencion|explic|claridad|seguimiento|entend|comprens|comprend|irrespons|incompeten|inepto|sincer|honest|dispuest|humano|calidez|vocaliz|serio|seriedad|asesoria"],
    ["aviso", "Avisos e información", "aviso|avis(ar|aron|en|ara|aran|ado|o)\\b|previo|notific|un comunicado|comunicados|\\bsms\\b|informa(r|cion|ron|ran)\\b|inform(en|aran|aron|aban)\\b|desinform|me informa\\b|no (nos |me |le )?(dicen|dijeron|explicaron|dan|daban|dieron) (cuando|cual|que paso|el tiempo|la hora|nada|el motivo|razon|informacion|explicacion)|da razon|dan razon|tiempo (estimado|aproximado)|cuanto (tiempo|tarda|demora|se demora|dura)|cuando (se )?(restablec|vuelve|soluciona|llega|regresa)|hora (de|aproximada) (solucion|restabl|llegada|reparacion)|falla (masiva|general)|dano (masivo|general)|(falla|dano)s? (en|de) (el|la|mi|toda la) (sector|zona|barrio)|(falla|dano|problema|mantenimiento|arreglo|trabajos?)[^.]{0,20} en (el|la|mi|todo el|toda la) (sector|zona|barrio|ciudad|municipio)|mantenimiento|falta de comunicacion|no (se )?comunican|no (nos )?(comunicaron|comunican)|que (paso|pasaba|estaba pasando)"],
    ["cobro", "Cobro y compensación", "cobr(?!e\\b|es\\b)|factur|recibo|descuent|compens|ajuste (en|a|al|de) (la |el |mi )?(factura|valor|cobro|cuenta)|reconoc(er|en|an|imiento|ieron) (el|los|la|lo|tiempo|dias|por)|devolu|devuelv(an|en|e)? (el |la |lo |mi |los )?(dinero|plata|valor|pago|cobrado|pagado|dias|tiempo)|reembols|reintegr|abono|nota credito|\\bpag(o|ar|ando|amos|ue|uen|a|an|ado|aremos|amos|o)\\b|pagando|mensualidad|tarifa|precio|\\bvalor(es)?\\b|\\bcaro\\b|costos|cuota|\\bplata\\b|dinero"],
    ["cancelar", "Cancelar o cambiarse", "cancel(o|are|e|amos|ando|acion|aciones) (el|los|mi|mis|todo|todos|la cuenta|el contrato|contrato|servicio|servicios|claro|con|definitivamente)|\\bcancelar\\b(?! (la |las |el |una )?(visita|cita|orden|reprogram))|(voy|vamos|pienso|quiero|toca|tocara|tendre|tocar|decidi|estoy pensando en|me toco) (a |que |en )?(cancel|retir|cambi)|\\bretir(ar|arme|o|arnos|e|aremos)\\b|cambiar(me|nos)? (de|a otro|a otra) (operador|empresa|compania|proveedor)|(otro|otra) (operador|empresa|compania|proveedor)|competencia|movistar|\\btigo\\b|\\bune\\b|\\betb\\b|\\bwom\\b|\\bme (voy|ire|pase|pasare|cambie|cambiare|cambio|paso) (de claro|a (otro|otra|tigo|movistar|etb|une|wom))|\\bme voy de\\b|\\bme voy\\b[^.]{0,20}(empresa|operador|compania)|dar de baja|doy de baja|terminar (el|mi) contrato|clausula|permanencia"],
    ["elogio", "Elogios", "^(?!\\W*(\\w+(ando|endo|iendo)(le|les|lo|los|la|las|nos|me|se)?|que|cumpla|cumplan|hagan|haga|den|sean|sea|tengan|pongan|brinden|ofrezcan|con|mas|mejor|tener|ser|dar|brindar|cumplir|mejorar|proveer\\w*|ofrecer|deberia\\w*|poder|necesito|ojala|quisiera|efectividad|agilidad|rapidez|eficiencia)\\b)(?![\\s\\S]*\\b(no|nada|poco|ni|nunca|nadie|ningun|ninguno|ninguna|sin|sigue|siguen|pesim\\w*|terrible|mal|mala|malo|falta|deberian|deben|deberia|mejorar|ser mas|sean mas|mas|momentane\\w*|tampoco|aun|todavia|pero|para que|toca|cansad\\w*|dificil|deficien\\w*|desconexion|quejas?|intermit\\w*|debil|lent[oa]|necesito|ojala|deberian|quien falla)\\b)[\\s\\S]*(excelent|exelent|muy (bien|buen|amable|rapid|atent|agil|eficien|profesional|clar|oportun|satisfech|amabl|diligent|efectiv)|buen(a|o|as|os)? (servicio|atencion|asesor|trato|experiencia|tecnico|soporte|respuesta|disposicion|gestion|solucion|trabajo|actitud|asesoria)|amabl|cordial|felicit|agradec|gracias|satisf|recomend|\\beficien|efectiv|rapid|agil|oportun|diligent|todo bien|perfect|genial|bien atendid|atento|atenta|(me|lo|la|nos|se) (solucionaron|soluciono|resolvieron|resolvio|arreglaron|arreglo)\\b|todo (solucionado|resuelto|arreglado|ok)|quedo (solucionad|funcionando|bien|resuelt)|\\bbuen[oa]?s?\\b|\\bbien\\b|\\bsuper\\b|chevere|contento|content[oa]|\\bfelic|maravill|espectacular|^\\W*10\\W*$|\\bun 10\\b|10 de 10)"]
  ];
  const stop = {}; "abril agosto alguien aparte brinda brindan brindar brindaron brinden brindo buenas buenos casa caso casos clientes cuenta dado dando decia decian deja dejan dejando dejar dejaron dejo demasiada demasiadas demasiado demasiados diciembre dieron digo dije dijeron domingo enero febrero fin hacen hacia haga hagan hago hecho hiciera hicieron hogar hoy jueves julio junio lleva llevaba llevamos llevan llevo lunes manera martes marzo mayo mejor mejorando mejorar mejore mejoren menos mes meses miercoles momento momentos mucha muchas muchisima muchisimo necesita necesitamos necesito ningun noches nosotros noviembre nuevamente octubre ok parece pasa pasado paso podemos poder podido porfavor posible presenta presentaba presentada presentadas presentado presentan presentando presentar presentaron presento pude pudieron pudo puedo queda quedaron quedo realiza realizar realizaron realizo realmente sabado sabe saber seguimos senores senorita septiembre setiembre siendo sigo siquiera situacion tampoco tanta tantos tardes tema temas toca tocaba tocado toco toda todas todavia tres usuarios varias varios ver verdad viernes".split(' ').forEach(w => { stop[w] = 1; });
  // Formas que se cuentan como una sola palabra (llamaron → llamada, vino → llegó, wpp → whatsapp…)
  const unir = {}; Object.entries({
    llamada: "llamar llame llama llaman llamo llamaron llamado llamando llamamos llamaba llamaban llamen llamarme llamaran llamare llamarlos",
    atiende: "atender atendio atendieron atendiera atienda atiendan atendida atendido atendiendo atendian atendia",
    demora: "demoran demoro demoraron demorado demorada demorados demorando demore demorar demoraba demoren",
    espera: "esperando esperar espere esperamos esperaba esperan esperen esperarlo esperandolo",
    llego: "llegaron llegan llega llegado llegar llegue llegaba llegara vino vinieron venido venir vienen viene vengan venia venian",
    falla: "fallando fallo fallan fallar fallaba fallado",
    whatsap: "wasap watsap wpp wsp whasap whatsaap whats wapp guasap whatssap wathsapp",
    bot: "bots boot chatbot robot robots robotizado robotizada",
    contest: "respond responde responden respondieron responder respondio respondan",
    trabajo: "trabajar trabajamos trabaja trabajando trabajan",
    cambiar: "cambio cambien cambie cambios cambiado",
    rapido: "rapida rapidas rapidez",
    reporta: "reporte reportes",
    arregla: "arreglo arreglen arreglos",
    resolve: "resolvieron resolvio resuelven resuelto resuelta resueltos resuelva resuelvan resolviendo",
    malo: "mala malas"
  }).forEach(([k, ws]) => ws.split(' ').forEach(w => { unir[w] = k; }));
  return {categorias: cats.map(([k, nombre, re]) => ({k, nombre, re: new RegExp(re)})), stop, unir, otros: 'Otros temas',
    nota: v => (v.q2 != null && v.q2 >= 0 ? v.q2 / 10 : null)};
})();
// Nube: un contenedor fijo (sobrevive a los repintados de la pestaña, así nube.js no suma escuchas en cada repintado)
const exEst = {lente: '', q: '', nube: {}, items: null, ancho: 0}, nubeEl = document.createElement('div');
const PREG = Object.fromEntries(D.cod_preguntas.map((c, i) => [c, D.preguntas[i]]));
const etqNotaNube = x => `recomendación media ${f1(x * 10)} de 10`;
const metaCom = v => { const e = V.estudio[v.r[DI.estudio]], m = V.marcacion[v.r[DI.marcacion]];
  return `<i class="punto" style="background:${CE[e]}"></i> ${esc(e)} · ${mesC(PERIODOS[v.r[0]])} · <span ${tipAttr(esc(PREG[v.preg] || v.preg))}>${esc(v.preg)}</span> · ${esc(m)}`; };
// Parte en palabras y clasifica todos los comentarios por tandas cortas mientras se ve otra pestaña (en Soporte-FM son
// ~25.000; de una vez toma más de medio segundo). Así, al abrir Voces con todos los meses, la nube solo cuenta.
function calentarNube(i = 0) {
  if (!window.NUBE || !C || i >= C.length) return;
  const fin = Math.min(C.length, i + 1200);
  for (let j = i; j < fin; j++) NUBE.preparar(C[j], NUBE_CFG);
  setTimeout(() => calentarNube(fin), 40);
}
function montarNube(quieto) {
  if (!window.NUBE) { nubeEl.innerHTML = '<p class="vacio">Falta nube.js junto al tablero.</p>'; return; }
  NUBE.montar(nubeEl, {items: exEst.items, cfg: NUBE_CFG, estado: exEst.nube, etqNota: etqNotaNube, chip: chipNota, meta: metaCom, quieto: !!quieto});
  exEst.ancho = nubeEl.clientWidth;
}
function vVoz(p, o = {}) {
  const idx = filas(), a = sumar(idx);
  const EMO_C = ['var(--d-2)', 'var(--d-2)', 'var(--d-1)', 'var(--d-1)', 'var(--d0)', 'var(--d1)', 'var(--d1)', 'var(--d2)', 'var(--d2)'];
  const emos = D.emociones.map((e, i) => ({nombre: e, c: a['emo_' + i], i})).filter(x => x.c), be = emos.reduce((s, x) => s + x.c, 0);
  // Comentarios de la nube: filtros globales + tipo + búsqueda; los vacíos o genéricos («ninguna», «ok», «bien») se cuentan pero no entran
  let total = 0;
  if (C) { const L = exEst.lente ? LENTES[exEst.lente] : null, q = norm(exEst.q); exEst.items = [];
    for (const v of C) if (pasaCom(v, L, q)) { total++; if (util(v)) exEst.items.push(v); } }
  const fuera = C ? total - exEst.items.length : 0;
  p.innerHTML = `
    <div class="g g2"><section class="panel"><header><h2>Emociones</h2><p class="sub">Q5 · rojo = negativas, verde = positivas.</p></header>${G.paletas(emos, be, {color: x => EMO_C[x.i]})}</section>
      <section class="panel"><header><h2>Cómo mejorar al asesor</h2><p class="sub">Temas de Qualtrics en Q10 · % sobre ${f0(a.com_q10)} encuestas con comentario.</p></header>${G.paletas(temas(TM, D.temas.mejora, idx), a.com_q10, {color: () => 'var(--cat)'})}</section></div>
    <section class="panel"><header><h2>Nube de comentarios</h2><span class="nota" ${C ? tipAttr(`${f0(total)} comentarios con estos filtros. ${fuera ? `${f0(fuera)} no dicen nada concreto («ninguna», «ok», «bien»…) y no entran en la nube.` : ''} Datos personales tapados.`) : ''}>${C ? `${f0(exEst.items.length)} comentarios${fuera ? ` · ${f0(fuera)} sin contenido fuera` : ''}` : 'Cargando…'}</span>
      <p class="sub">Cada comentario cae en uno o varios temas. Elige un tema a la izquierda o una palabra para leer los comentarios que más se repiten.</p></header>
      <div class="ex-herr"><input type="search" id="ex-q" placeholder="Buscar: visita, técnico, whatsapp, factura…" value="${esc(exEst.q)}" aria-label="Buscar en comentarios">
        <div class="lentes" role="group" aria-label="Tipo de comentario"><button type="button" class="l-todos" data-l="" aria-pressed="${!exEst.lente}">Todos</button>${Object.entries(GRUPO_L).map(([k, ls]) => {
          const sel = ls.includes(exEst.lente);
          return `<fieldset class="l-grupo${sel ? ' activo' : ''}"${sel ? ` style="--gc:${tonoL(exEst.lente)}"` : ''}><legend>${IND[k].corto}</legend>${ls.map(l => `<button type="button" data-l="${l}" class="${l === 'neu' ? 'neutro' : ''}" style="--lc:${tonoL(l)}" aria-pressed="${exEst.lente === l}" aria-label="${IND[k].corto}: ${LENTES[l].t}"><i></i>${LENTES[l].c || LENTES[l].t}</button>`).join('')}</fieldset>`; }).join('')}</div></div>
      <div id="ex-nube">${C ? '' : '<div class="nb-esq"><div class="esqueleto"></div><div class="esqueleto"></div></div>'}</div></section>`;
  if (C) { const ph = p.querySelector('#ex-nube'); ph.appendChild(nubeEl); montarNube(o.quieto); }
  const q = p.querySelector('#ex-q'); let t;
  q.oninput = () => { clearTimeout(t); t = setTimeout(() => { exEst.q = q.value.trim(); pintarTab({anim: false, quieto: true}); const n = p.querySelector('#ex-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
  p.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { exEst.lente = b.dataset.l; pintarTab({anim: false}); });
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
  p.querySelectorAll('.meses button').forEach(b => b.onclick = () => { fijarMeses([+b.dataset.i]); refrescar(); });
}
// Llegaron los comentarios: solo cambian los carruseles (y el explorador de Voces)
function conComentarios() {
  if (st.tab === 'voz') pintarTab({anim: false});
  else repintarCarruseles(document.getElementById('p-' + st.tab));
  const sd = document.getElementById('dolores'); if (sd && dolEst.voz) ponerVoces(sd, false);
}
const VISTAS = {resumen: vResumen, facilidad: vFacilidad, resolucion: vResolucion, asesor: vAsesor, voz: vVoz, calidad: vCalidad};
// o.anim = false: repinta en el estado final, sin animar (tema, buscador de Voces, comentarios)
function pintarTab(o = {}) {
  const p = document.getElementById('p-' + st.tab);
  VISTAS[st.tab](p, o);
  montarRanking(p); montarCarrusel(p); dibujarLineas(p);
  p.querySelectorAll('[data-cajon]').forEach(b => b.onclick = () => abrirCajon(b.dataset.cajon));
  if (o.anim !== false) G.animar(p);
  if (!C && st.tab !== 'calidad') cargarComentarios();
}

// ------------------------------------------------------------------ spotlight por indicador
const cajon = document.getElementById('cajon'), velo = document.getElementById('velo'); let volverA = null;
function abrirCajon(k, foco = true) {
  if (foco) volverA = document.activeElement;
  const a = sumar(filas()), r = IND[k].calc(a), [malo, bueno] = PAR[k];
  const gr = ests().map(e => ({nombre: EST[e], a: sumar(filas({estudio: e}))}));
  const dist = k === 'nps' ? wafNps(gr) : k === 'fun' ? donasFun(gr) : k === 'ces' ? divergente(gr) :
    G.relojes(D.q9.map((nom, j) => { const q = `q9_${j + 1}`; return {nombre: nom, series: [{e: st.estudio == null ? 'Total' : EST[st.estudio], color: 'var(--ink-3)', r: prop(a[q + '_top2'], a[q + '_val'])}]}; }));
  const col = l => { const ej = ejemplos(l, 4); return `<div class="col"><h4><i class="punto" style="background:${LENTES[l].malo ? 'var(--d-2)' : 'var(--d2)'}"></i>${LENTES[l].t}${ej ? ` <span class="nota">${f0(ej.total)}</span>` : ''}</h4>${ej == null ? '<div class="esqueleto"></div>' : ej.items.map(v => tarjeta(v)).join('') || '<p class="nota">Sin comentarios</p>'}</div>`; };
  cajon.dataset.k = k;
  cajon.innerHTML = `<header><span class="nota">${etqMeses(st.meses)} · ${alcance()}</span><h2 id="cajon-t" style="margin:0;font:900 22px var(--f-num)">${IND[k].nombre}</h2>
      <div class="big">${fmtGrande(k, r)}</div><p class="def">${esc(IND[k].def)}</p><span class="nota">n ${r ? f0(r.n) : 0}${r ? ` · IC 95 % ±${f1(r.ic)}` : ''}</span>
      <button type="button" class="icono x" aria-label="Cerrar">${svgI('x')}</button></header>
    <div class="cuerpo"><div><h3>Mes a mes</h3><div class="chart" style="min-height:170px" data-lineas="${k}" data-modo="mes" id="cj-l"></div>${tablaPH('cj-l')}</div>
      <div><h3>Distribución</h3>${dist}</div>
      <div><h3>Lo que dicen</h3><div class="dos">${col(malo)}${col(bueno)}</div>
      <button type="button" class="mas" id="cj-mas">Ver todos en Voces ›</button></div></div>`;
  cajon.hidden = velo.hidden = false;
  requestAnimationFrame(() => { cajon.classList.add('ver'); velo.classList.add('ver'); dibujarLineas(cajon); G.animar(cajon, {inmediato: true}); });
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
function dlPeriodos() { return dlEst.alcance === 'mes' ? st.meses.map(i => PERIODOS[i]) : D.base.periodos; }
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
    <div><div class="et-dl">Meses</div><div class="seg" role="group" aria-label="Meses"><button type="button" data-a="mes" aria-pressed="${dlEst.alcance === 'mes'}">${etqMeses(st.meses)}</button><button type="button" data-a="todos" aria-pressed="${dlEst.alcance === 'todos'}">Todos (${mesC(D.base.periodos[0])} a ${mesC(D.base.periodos[D.base.periodos.length - 1])})</button></div></div>
    <div><div class="et-dl">Formato</div><div class="seg" role="group" aria-label="Formato"><button type="button" data-f="xlsx" aria-pressed="${dlEst.formato === 'xlsx'}" title="Libro de Excel (.xlsx)">Excel</button><button type="button" data-f="csv" aria-pressed="${dlEst.formato === 'csv'}" title="Texto separado por punto y coma">CSV</button><button type="button" data-f="parquet" aria-pressed="${dlEst.formato === 'parquet'}" title="Columnar y comprimido, para Python o Power BI">Parquet</button></div></div>
    <div class="resumen-dl"><b>${f0(n)} encuestas</b>${esc(filtrosTxt())}</div>
    <button type="button" class="ir"${n ? '' : ' disabled'}><span>Descargar ${dlEst.formato === 'xlsx' ? 'Excel' : dlEst.formato.toUpperCase()}</span></button>
    <p class="nota" style="margin:0">Una fila por encuesta con cuenta, teléfono y correo, indicadores, segmentos, clasificación de red (HFC, FTTH propia o neutra, DTH), categoría_dolor y comentarios (con [nombre], [#] y [correo] tapados). Trae datos personales: compártela solo con quien deba contactar al cliente.</p>`;
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
// Cuenta, teléfono y correo van en contacto/AAAAMM.js (por ID de respuesta) y se pegan después del ID al descargar
const cargarContacto = p => new Promise(ok => {
  if (window.CONTACTO?.[p]) return ok(window.CONTACTO[p]);
  const sc = document.createElement('script'); sc.src = `contacto/${p}.js`;
  sc.onload = () => ok(window.CONTACTO?.[p] || {}); sc.onerror = () => ok({});   // sin archivo: columnas vacías
  document.body.appendChild(sc);
});
const VACIO_C = D.base.contacto.map(() => '');
const lineaCSV = f => f.map(v => /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(';');
async function descargarBase(btn) {
  if (btn.dataset.estado === 'trabajando') return;
  const txt = btn.querySelector('span'), etq = txt.textContent, aviso = (e, t, p) => { btn.dataset.estado = e; txt.textContent = t; btn.style.setProperty('--p', (p ?? 0) + '%'); };
  try {
    const cols = [D.base.columnas[0], ...D.base.contacto, ...D.base.columnas.slice(1)], ci = c => cols.indexOf(c), ps = dlPeriodos();
    const conds = [];
    if (st.estudio != null) { const j = ci(D.base.filtro.estudio), v = EST[st.estudio]; conds.push(r => r[j] === v); }
    for (const [k] of MULTI) if (st[k].size) { const j = ci(D.base.filtro[k]), vs = new Set([...st[k]].map(i => V[k][i])); conds.push(r => vs.has(r[j])); }
    const w = EXPORTAR.crear(dlEst.formato, cols);
    let n = 0;
    for (let i = 0; i < ps.length; i++) {
      aviso('trabajando', `Preparando ${Math.round(i / ps.length * 100)} %`, i / ps.length * 100);
      const [b, ct] = await Promise.all([cargarBase(ps[i]), cargarContacto(ps[i])]);
      const rows = b.map(r => [r[0], ...(ct[r[0]] || VACIO_C), ...r.slice(1)]).filter(r => conds.every(c => c(r)));
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
  pintarTema(); pintarTab({anim: false, quieto: true});
};

// ------------------------------------------------------------------ ciclo
function refrescar(o = {}) {
  pintarCtrl(); pintarFiltros();
  if (o.mantener === '__mes') ctrl.querySelector('#f-per button.sel')?.click();
  else if (o.mantener) barF.querySelector(`.pill-f[data-k="${o.mantener}"] button`)?.click();
  pintarNav(); pintarTab(); escribirHash(); pintarDescarga();
  if (cajon.dataset.k) abrirCajon(cajon.dataset.k, false);
}
leerHash();
const ult = PERIODOS[PERIODOS.length - 1];
document.getElementById('actualizado').textContent = D.generado.slice(0, 10).split('-').reverse().join('/');
document.getElementById('sello').textContent = `${mesC(PERIODOS[0])} a ${mesC(ult)} · ${f0(PERIODOS.reduce((s, p) => s + D.periodos[p].n, 0))} encuestas`;
pintarTema(); refrescar();
// Al cambiar el tamaño se redibujan las líneas sin animar
let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => {
  const h = document.documentElement; h.setAttribute('data-sin-anim', '');
  dibujarLineas(document.getElementById('p-' + st.tab)); if (cajon.dataset.k) dibujarLineas(cajon);
  // La nube se acomoda al ancho nuevo (solo si cambió: en el celular la barra de direcciones dispara resize al hacer scroll)
  if (st.tab === 'voz' && nubeEl.isConnected && Math.abs(nubeEl.clientWidth - exEst.ancho) > 8) montarNube(true);
  h.removeAttribute('data-sin-anim'); }, 150); });
addEventListener('hashchange', () => { leerHash(); refrescar(); });
// Al imprimir, la nube sale completa aunque nunca haya entrado en pantalla (sus palabras esperan a verse para animarse)
addEventListener('beforeprint', () => { if (st.tab === 'voz' && nubeEl.isConnected) montarNube(true); });
})();
