/* navegacion.js · filtros con la selección resaltada y riel de vistas que se esconde (navegacion.css).
   El MISMO archivo va en los tableros Factura, Soporte-FM y Digital: si se cambia uno, copiarlo a los otros.
   No cambia lo que hace cada tablero: decora lo que app.js pinta en #ctrl, #filtros y #nav (y lo vuelve a decorar cada vez
   que app.js los repinta). Anima con Motion si está; sin él, con transiciones CSS.
   Se incrusta en Tableau (Chromium viejo): sin .at(), ||=, ??=, ?., replaceAll ni structuredClone. */
'use strict';
(function () {
var M = window.Motion || null, raiz = document.documentElement;
var reducir = false;
try { reducir = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reducir = false; }
var anima = function () { return !!M && !reducir && !raiz.hasAttribute('data-sin-anim'); };
var ancho = function () { return innerWidth > 760; };
function cada(lista, fn) { Array.prototype.forEach.call(lista, fn); }

// ------------------------------------------------------------------ 1. filtros
var TODOS = /^\s*(todos?|ambos)\s*$/i, antes = {};
function leyenda(g, txt) {
  var l = g.querySelector('.fg-leg');
  if (!l) { l = document.createElement('span'); l.className = 'fg-leg'; l.setAttribute('aria-hidden', 'true'); g.insertBefore(l, g.firstChild); }
  l.textContent = txt;
}
function pulso(g, b) {
  if (!anima()) return;
  g.classList.remove('fg-pulso'); void g.offsetWidth; g.classList.add('fg-pulso');
  if (b) M.animate(b, {transform: ['scale(.78)', 'scale(1)']}, {type: 'spring', bounce: .55, duration: .5});
}
function decorarGrupos(cont) {
  cada(cont.querySelectorAll('.seg[role="group"]'), function (g) {
    var bs = g.querySelectorAll('button');
    if (!bs.length) return;
    g.classList.add('fg');
    leyenda(g, g.getAttribute('aria-label') || '');
    var elegido = null;
    cada(bs, function (b, i) {
      var pt = b.querySelector('i');
      b.style.setProperty('--lc', pt && pt.style.background ? pt.style.background : 'var(--fg-def)');
      b.classList.toggle('fg-todos', i === 0 && (b.getAttribute('data-v') === '' || TODOS.test(b.textContent)));
      if (b.getAttribute('aria-pressed') === 'true') elegido = b;
    });
    var filtra = !!elegido && !elegido.classList.contains('fg-todos');
    g.classList.toggle('fg-on', filtra);
    g.style.setProperty('--gc', filtra ? elegido.style.getPropertyValue('--lc') : 'var(--line-2)');
    var id = g.id || g.getAttribute('aria-label'), ahora = elegido ? elegido.textContent : '';
    if (antes[id] != null && antes[id] !== ahora) pulso(g, elegido);
    antes[id] = ahora;
  });
  cada(cont.querySelectorAll('.mes-f'), function (g) {
    g.classList.add('fg', 'fg-mes');
    var b = g.querySelector('button.sel'), varios = b && b.querySelector('b');
    leyenda(g, varios ? 'Meses' : 'Mes');
    var ahora = b ? b.textContent : '';
    if (antes.__mes != null && antes.__mes !== ahora) pulso(g, null);
    antes.__mes = ahora;
  });
}
function decorarListas(cont) {
  cada(cont.querySelectorAll('.pill-f'), function (g) {
    var b = g.querySelector(':scope > button'), sp = b && b.querySelector('span');
    if (!b || !sp) return;
    var on = b.classList.contains('activo'), id = 'pill-' + g.getAttribute('data-k');
    g.classList.toggle('fg', on); g.classList.toggle('fg-on', on);
    var vieja = g.querySelector('.fg-leg');
    if (!on) { if (vieja) vieja.remove(); antes[id] = ''; return; }
    // «Región: <b>Costa</b>» → nombre arriba («Región») y adentro solo el valor («Costa» o «3 elegidos»)
    var et = sp.textContent.split(':')[0].replace(/^\+\s*/, '').trim(), val = sp.querySelector('b');
    leyenda(g, et);
    if (val && !sp.getAttribute('data-fg')) {
      var v = val.textContent.trim();
      sp.textContent = /^\d+$/.test(v) ? v + ' elegidos' : v;
      sp.setAttribute('data-fg', '1');
      b.setAttribute('aria-label', et + ': ' + sp.textContent);
    }
    if (antes[id] !== sp.textContent) { if (antes[id] != null) pulso(g, b); antes[id] = sp.textContent; }
  });
}
function decorar() {
  var c = document.getElementById('ctrl'), f = document.getElementById('filtros');
  if (c) { decorarGrupos(c); decorarListas(c); }
  if (f) { decorarGrupos(f); decorarListas(f); }
}
['ctrl', 'filtros'].forEach(function (id) {
  var el = document.getElementById(id);
  if (el && window.MutationObserver) new MutationObserver(decorar).observe(el, {childList: true});
});
decorar();

// ------------------------------------------------------------------ 2. riel de vistas
var rail = document.querySelector('.rail'), nav = document.getElementById('nav');
if (!rail || !nav) return;
var luz = document.createElement('span'); luz.className = 'nv-luz'; luz.setAttribute('aria-hidden', 'true'); rail.insertBefore(luz, rail.firstChild);
var asa = document.createElement('button');
asa.type = 'button'; asa.className = 'nv-asa'; asa.setAttribute('aria-label', 'Mostrar el menú de vistas');
document.body.appendChild(asa);
var dormido = false, timer = null, dentro = false;

function botones() { return nav.querySelectorAll('button'); }
function activo() { return nav.querySelector('button[aria-selected="true"]'); }
function pintarAsa() {
  var html = '';
  cada(botones(), function (b) { html += '<i class="' + (b.getAttribute('aria-selected') === 'true' ? 'on' : (b.querySelector('.badge') ? 'aviso' : '')) + '"></i>'; });
  asa.innerHTML = html;
  var a = activo(); asa.title = a ? 'Vista: ' + a.textContent.replace(/\d+$/, '').trim() + ' · clic para cambiar' : 'Vistas';
}
function moverLuz() {
  var a = activo();
  if (!a || !ancho()) { luz.style.opacity = '0'; return; }
  luz.style.opacity = '1'; luz.style.top = a.offsetTop + 'px'; luz.style.height = a.offsetHeight + 'px';
}
function alCambiarNav() { pintarAsa(); moverLuz(); }
if (window.MutationObserver) new MutationObserver(alCambiarNav).observe(nav, {childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected']});
alCambiarNav();

function despertar() {
  clearTimeout(timer);
  if (!dormido) return;
  dormido = false; raiz.classList.remove('nv-dormido');
  if (ancho() && anima()) {
    var bs = botones();
    M.animate(bs, {opacity: [0, 1], transform: ['translateX(-16px) scale(.6)', 'translateX(0px) scale(1)']}, {delay: M.stagger(.04, {startDelay: .08}), type: 'spring', bounce: .4, duration: .55})
      .then(function () { if (!dormido) cada(bs, function (b) { b.style.opacity = ''; b.style.transform = ''; }); });
    M.animate(luz, {opacity: [0, 1], transform: ['scaleX(.3)', 'scaleX(1)']}, {delay: .25, duration: .45, ease: [.22, 1, .36, 1]});
  }
  requestAnimationFrame(moverLuz);
}
function dormir() {
  clearTimeout(timer);
  if (dormido || dentro || rail.contains(document.activeElement)) return;
  if (ancho() && anima()) M.animate(botones(), {opacity: [1, 0], transform: ['translateX(0px) scale(1)', 'translateX(-10px) scale(.8)']}, {delay: M.stagger(.025, {from: 'last'}), duration: .22}).then(function () { cada(botones(), function (b) { b.style.opacity = ''; b.style.transform = ''; }); });
  dormido = true; raiz.classList.add('nv-dormido');
  lupa(null);
}
var luego = function (ms) { clearTimeout(timer); timer = setTimeout(dormir, ms); };

// Pantalla ancha: dock con lupa, se esconde al dejarlo; vuelve al acercarse al borde izquierdo, al asa o con el teclado
function lupa(y) {
  cada(botones(), function (b) {
    var s = b.querySelector('svg'); if (!s) return;
    if (y == null || reducir) { s.style.transform = ''; return; }
    var r = b.getBoundingClientRect(), d = Math.abs(y - (r.top + r.height / 2)), k = Math.max(0, 1 - d / 120);
    s.style.transform = 'scale(' + (1 + .32 * k * k).toFixed(3) + ') translateX(' + (3 * k).toFixed(1) + 'px)';
  });
}
rail.addEventListener('mouseenter', function () { dentro = true; despertar(); });
rail.addEventListener('mouseleave', function () { dentro = false; lupa(null); if (ancho()) luego(1100); });
rail.addEventListener('mousemove', function (e) { if (ancho()) lupa(e.clientY); });
rail.addEventListener('focusin', despertar);
rail.addEventListener('focusout', function () { setTimeout(function () { if (!rail.contains(document.activeElement) && ancho()) luego(900); }, 0); });
rail.addEventListener('click', function (e) { if (e.target.closest('button') && ancho() && !dentro) luego(900); });
asa.addEventListener('click', function () { despertar(); if (!ancho()) { raiz.classList.remove('nv-abajo'); } else { var a = activo(); if (a) a.focus({preventScroll: true}); } });
asa.addEventListener('mouseenter', despertar);
document.addEventListener('mousemove', function (e) { if (dormido && ancho() && e.clientX <= 18) despertar(); });
// Táctil en pantalla ancha (tableta): tocar fuera lo esconde
document.addEventListener('pointerdown', function (e) { if (!dormido && ancho() && e.pointerType !== 'mouse' && !rail.contains(e.target) && e.target !== asa) dormir(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !dormido && rail.contains(document.activeElement)) { document.activeElement.blur(); dormir(); } });

// Celular: la barra de abajo se esconde al bajar y vuelve al subir (o al tocar el asa)
var yAnt = scrollY;
addEventListener('scroll', function () {
  if (ancho()) return;
  var y = scrollY;
  if (y > yAnt + 8 && y > 140) raiz.classList.add('nv-abajo');
  else if (y < yAnt - 8 || y < 60) raiz.classList.remove('nv-abajo');
  yAnt = y;
}, {passive: true});
addEventListener('resize', function () { if (ancho()) raiz.classList.remove('nv-abajo'); else { raiz.classList.remove('nv-dormido'); dormido = false; } moverLuz(); });

// Al abrir: el riel se muestra un momento (para que se sepa que está) y luego se disuelve en el asa
if (ancho()) luego(2600);
})();
