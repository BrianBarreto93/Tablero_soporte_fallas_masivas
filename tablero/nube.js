/* nube.js · nube de temas de los comentarios (tableros Factura, pago y cobro / Soporte y Fallas masivas).
   El MISMO archivo va en los tres tableros (Factura, Soporte-FM y Digital): si se cambia uno, copiarlo a los otros. Usa graficos.js (GRAF.tono) y Motion si está.

   Qué hace:
   1. Parte cada comentario en palabras (minúsculas, sin tildes, sin palabras vacías) y agrupa singular/plural.
   2. Asigna a cada comentario una o varias categorías con las reglas del tablero (expresiones sobre el texto normalizado).
   3. Cuenta en cuántos comentarios aparece cada palabra o par de palabras («sin servicio», «no llega») y arma la nube:
      tamaño = comentarios que la mencionan, color = nota media de quienes la mencionan (rojo intenso → verde sobrio).
   4. Al elegir una palabra, agrupa los comentarios casi iguales y los ordena por cuántas veces se repiten y por qué tan
      típicos son (parecido con el resto de comentarios de esa palabra).
   Todo se calcula en el navegador con los filtros activos. Sin .at(), ||=, ??=, ?., replaceAll ni structuredClone. */
'use strict';
(function () {
var STOP = ('a al algo algun alguna algunas alguno algunos alla alli ante antes aqui asi aun aunque cada casi como con contra cual cuales cuando ' +
  'de del desde donde dos e el ella ellas ello ellos en entre era eran es esa esas ese eso esos esta estaba estaban estan estar este esto estos ' +
  'fue fueron ha haber habia han has hasta hay he la las le les lo los mas me mi mis mucho muchos muy nada ni nos o os otra otras otro otros ' +
  'para pero poco por porque pues que quien se sea ser si sido sin sobre son su sus tambien tan tanto te tener tiene tienen todo todos tu tus ' +
  'un una uno unos usted ustedes va van vez y ya yo q xq pq etc dia dias cosa cosas forma parte vez veces hace hacer hizo puede pueden ' +
  'tengo tenia tenido estoy esta estuvo sigue siguen solo bueno pues entonces ahi ahora luego despues siempre nunca mismo misma cual ' +
  'favor gracias hola senor senora señor señora dijo dice dicen decir manifiesta menciona indica comenta refiere informa expresa afirma ' +
  'cliente clienta usuario usuaria titular persona respuesta encuesta pregunta ninguna ninguno nadie ademas igual tal medio mientras ' +
  'claro claros ser sido seria estaria tuvo tuve han ha hemos habian hubo vamos voy da dan dar dio den esten este estas quiero quiere ' +
  'debe deben deberia deberian podria podrian fueran fuera sean sea').split(' ');
var STOPSET = {}; STOP.forEach(function (w) { STOPSET[w] = 1; });
// Palabras que solas no dicen nada pero sí como inicio de un par («sin servicio», «no llega», «mala atención»)
var CABEZA = {no: 1, sin: 1, mal: 1, mala: 1, malo: 1, buen: 1, buena: 1, bueno: 1, muy: 1, mas: 1, poca: 1, poco: 1, falta: 1, nunca: 1};

function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
// Raíz simple: une singular y plural (facturas → factura, valores → valor, señales → señal, veces → vez)
function raiz(w) {
  if (w.length > 5 && /ciones$/.test(w)) return w.slice(0, -2);
  if (w.length > 4 && /[rlnd]es$/.test(w)) return w.slice(0, -2);
  if (w.length > 4 && /ces$/.test(w)) return w.slice(0, -3) + 'z';
  if (w.length > 3 && /[aeiou]s$/.test(w)) return w.slice(0, -1);
  return w;
}
// Clave de agrupación: raíz y, si es larga, sus 7 primeras letras (solución, solucionan, solucionaron → «solucio»)
function clave(w) { var r = raiz(w); return r.length >= 8 ? r.slice(0, 7) : r; }
var TOKEN = /[a-zñ]+/g, TOKEN_O = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g;

// Prepara (una sola vez) un comentario: tokens con raíz, forma original de cada raíz, texto normalizado y categorías
function preparar(v, cfg) {
  if (v._nb && v._nb.cfg === cfg) return v._nb;
  var n = norm(v.texto), orig = v.texto.match(TOKEN_O) || [], toks = n.match(TOKEN) || [];
  var r = [], formas = {};
  for (var i = 0; i < toks.length; i++) {
    var w = toks[i], st = STOPSET[w] || (cfg.stop && cfg.stop[w]) || w.length < 3;
    var k = (cfg.unir && cfg.unir[w]) || clave(w);
    r.push({k: k, stop: !!st, cab: !!CABEZA[w], w: w});
    if (!st && orig[i] && norm(orig[i]) === w) { var f = orig[i].toLowerCase(); formas[k] = formas[k] || {}; formas[k][f] = (formas[k][f] || 0) + 1; }
  }
  var cats = [];
  (cfg.categorias || []).forEach(function (c) { if (c.re.test(n)) cats.push(c.k); });
  var set = {};
  r.forEach(function (t, j) {
    if (!t.stop) set[t.k] = 1;
    if (j && !t.stop && (!r[j - 1].stop || r[j - 1].cab) && r[j - 1].w.length > 1) set[(r[j - 1].cab ? r[j - 1].w : r[j - 1].k) + ' ' + t.k] = 1;
  });
  v._nb = {cfg: cfg, n: n, t: r, set: set, formas: formas, cats: cats.length ? cats : ['_otros']};
  return v._nb;
}

// ------------------------------------------------------------------ análisis
// items = comentarios ya filtrados. cfg = {categorias:[{k, nombre, re}], stop:{palabra:1}, nota: v => 0..1|null, max: 60, min: 3}
function analizar(items, cfg) {
  var df = {}, formas = {}, catN = {}, catS = {}, catNs = {}, notaT = {}, notaN = {}, catDe = {}, sT = 0, sN = 0;
  items.forEach(function (v) {
    var p = preparar(v, cfg), nota = cfg.nota ? cfg.nota(v) : null;
    if (nota != null) { sT += nota; sN++; }
    p.cats.forEach(function (c) { catN[c] = (catN[c] || 0) + 1; if (nota != null) { catS[c] = (catS[c] || 0) + nota; catNs[c] = (catNs[c] || 0) + 1; } });
    for (var k in p.set) {
      df[k] = (df[k] || 0) + 1;
      if (nota != null) { notaT[k] = (notaT[k] || 0) + nota; notaN[k] = (notaN[k] || 0) + 1; }
      var cd = catDe[k] || (catDe[k] = {}); p.cats.forEach(function (c) { cd[c] = (cd[c] || 0) + 1; });
    }
    for (var f in p.formas) { var fo = formas[f] || (formas[f] = {}); for (var s in p.formas[f]) fo[s] = (fo[s] || 0) + p.formas[f][s]; }
  });
  var min = cfg.min || Math.max(3, Math.round(items.length * .004)), max = cfg.max || 60;
  // Candidatas: palabras sueltas y pares frecuentes
  var cand = [];
  for (var k in df) {
    if (df[k] < min) continue;
    var par = k.indexOf(' ') > 0;
    if (par) {
      var ps = k.split(' '), a = ps[0], b = ps[1];
      // Un par entra si es casi siempre el contexto de su palabra principal (o si empieza con «no», «sin», «mala»…)
      var base = Math.min(df[a] || 1e9, df[b] || 1e9);
      if (!CABEZA[a] && df[k] / base < .35) continue;
      if (CABEZA[a] && df[k] < min + 1) continue;
    } else if (cfg.stop && cfg.stop[k]) continue;
    cand.push(k);
  }
  // Una palabra sola sobra si un par la cubre casi entera («servicio» dentro de «sin servicio»)
  var pares = cand.filter(function (k) { return k.indexOf(' ') > 0; });
  cand = cand.filter(function (k) {
    if (k.indexOf(' ') > 0) return true;
    return !pares.some(function (p) { var s = p.split(' '); return (s[1] === k || s[0] === k) && df[p] >= df[k] * .7; });
  });
  cand.sort(function (a, b) { return df[b] - df[a] || (a < b ? -1 : 1); });
  cand = cand.slice(0, max);
  var mostrar = function (k) {
    return k.split(' ').map(function (p) {
      var fo = formas[p]; if (!fo) return p;
      var best = null; for (var s in fo) if (!best || fo[s] > fo[best]) best = s; return best;
    }).join(' ');
  };
  var palabras = cand.map(function (k) {
    var cd = catDe[k], cat = null, cm = 0;
    for (var c in cd) if (c !== '_otros' && cd[c] > cm) { cm = cd[c]; cat = c; }
    return {key: k, t: mostrar(k), n: df[k], nota: notaN[k] ? notaT[k] / notaN[k] : null, nNota: notaN[k] || 0, cat: cat || '_otros', catDe: cd};
  });
  var cats = (cfg.categorias || []).concat([{k: '_otros', nombre: cfg.otros || 'Otros temas'}]).map(function (c) {
    return {k: c.k, nombre: c.nombre, n: catN[c.k] || 0, nota: catNs[c.k] ? catS[c.k] / catNs[c.k] : null, pct: items.length ? (catN[c.k] || 0) / items.length * 100 : 0};
  }).filter(function (c) { return c.n; });
  return {total: items.length, palabras: palabras, cats: cats, df: df, prom: sN ? sT / sN : null};
}

// ------------------------------------------------------------------ comentarios parecidos
function jaccard(a, b) {
  var i = 0, u = 0, k;
  for (k in a) { u++; if (b[k]) i++; }
  for (k in b) if (!a[k]) u++;
  return u ? i / u : 0;
}
// Devuelve grupos de comentarios casi iguales que mencionan la palabra (key = null: todos), del más repetido al menos.
// o = {cat: filtra por categoría, max: grupos, umbral: parecido mínimo para juntar (Jaccard)}
function similares(items, key, cfg, o) {
  o = o || {};
  var con = items.filter(function (v) { var p = preparar(v, cfg); return (!key || p.set[key]) && (!o.cat || p.cats.indexOf(o.cat) >= 0); });
  if (!con.length) return {n: 0, grupos: []};
  // Centro: cuántos de estos comentarios usan cada palabra (pesada por rareza en todo el conjunto)
  var N = items.length, df = o.df || {}, cen = {};
  con.forEach(function (v) { for (var k in v._nb.set) if (k.indexOf(' ') < 0) cen[k] = (cen[k] || 0) + 1; });
  var peso = function (k) { return Math.log(1 + N / (1 + (df[k] || 1))); };
  var tipico = function (v) {
    var s = 0, n = 0; for (var k in v._nb.set) if (k.indexOf(' ') < 0) { n++; if (k !== key) s += (cen[k] - 1) * peso(k); }
    return n ? s / Math.sqrt(n) : 0;
  };
  var cand = con.map(function (v) { return {v: v, s: tipico(v), set: v._nb.set}; });
  cand.sort(function (a, b) { return b.s - a.s; });
  var grupos = [], umbral = o.umbral || .5;
  cand.forEach(function (c) {
    for (var i = 0; i < grupos.length; i++) {
      var g = grupos[i];
      if (g.rep.v._nb.n === c.v._nb.n || jaccard(g.rep.set, c.set) >= umbral) { g.miembros.push(c.v); return; }
    }
    if (grupos.length < 400) grupos.push({rep: c, miembros: [c.v]});
  });
  grupos.forEach(function (g) {
    var s = 0, n = 0; g.miembros.forEach(function (v) { var x = cfg.nota ? cfg.nota(v) : null; if (x != null) { s += x; n++; } });
    g.nota = n ? s / n : null;
  });
  // Primero los que más se repiten; a igual repetición, el más típico. Comentarios muy cortos al final.
  grupos.sort(function (a, b) { return (b.miembros.length - a.miembros.length) || ((b.rep.v.texto.length >= 25) - (a.rep.v.texto.length >= 25)) || (b.rep.s - a.rep.s); });
  return {n: con.length, grupos: grupos.slice(0, o.max || 8)};
}

// ------------------------------------------------------------------ dibujo de la nube (espiral, sin solapes)
var lienzo = null;
function medir(txt, px, peso) {
  if (!lienzo) lienzo = document.createElement('canvas').getContext('2d');
  lienzo.font = peso + ' ' + px + 'px Nunito, "Nunito Sans", system-ui, sans-serif';
  return lienzo.measureText(txt).width;
}
function choca(r, ocup) {
  for (var i = 0; i < ocup.length; i++) { var o = ocup[i]; if (r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y) return true; }
  return false;
}
// Coloca las palabras en espiral desde el centro (la más mencionada en el centro). Devuelve el HTML y el alto usado.
function disponer(palabras, ancho, o) {
  o = o || {};
  if (!palabras.length) return {html: '', alto: 0};
  var maxN = palabras[0].n, minN = palabras[palabras.length - 1].n, pxMin = o.pxMin || 13, pxMax = Math.min(o.pxMax || 54, Math.max(26, ancho / 9));
  var esc = function (n) { return maxN === minN ? (pxMin + pxMax) / 2 : pxMin + (pxMax - pxMin) * Math.sqrt((n - minN) / (maxN - minN)); };
  var alto = o.alto || Math.max(260, Math.min(520, ancho * .55)), cx = ancho / 2, cy = alto / 2, ocup = [], out = [];
  palabras.forEach(function (p, i) {
    var px = Math.round(esc(p.n)), peso = px > 30 ? 900 : px > 20 ? 800 : 700, w = medir(p.t, px, peso) + 14, h = px * 1.18 + 6;
    var ok = null;
    for (var t = 0; t < 2400 && !ok; t += 1) {
      var ang = t * .21, rad = 2.2 * ang;
      var x = cx + rad * Math.cos(ang) * (ancho / alto) * .9 - w / 2, y = cy + rad * Math.sin(ang) - h / 2;
      if (x < 2 || y < 2 || x + w > ancho - 2 || y + h > alto - 2) continue;
      var r = {x: x, y: y, w: w, h: h};
      if (!choca(r, ocup)) ok = r;
    }
    if (!ok) return;   // no cupo: se avisa con el contador de ocultas
    ocup.push(ok); out.push({p: p, r: ok, px: px, peso: peso, i: i});
  });
  return {cajas: out, alto: alto, ocultas: palabras.length - out.length};
}

function escH(s) { return String(s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
// Color de una palabra: su nota media frente a la nota media de todos los comentarios mostrados.
// Igual al promedio = ámbar; 2,3 puntos de 10 por debajo = rojo intenso; 2,3 por encima = verde sobrio.
var SPAN = .23;
function colorNota(x, prom) {
  if (x == null) return 'var(--ink-3)';
  if (!window.GRAF) return 'var(--ink-2)';
  return GRAF.tono(prom == null ? x : .5 + (x - prom) / (2 * SPAN));
}

// Pinta la nube en el contenedor el. o = {sel: key elegida, etqNota: v => texto, onElegir: (palabra, boton) => void}
function pintar(el, an, o) {
  o = o || {};
  var ancho = el.clientWidth || 800;
  var d = disponer(an.palabras, ancho, o);
  if (!an.palabras.length) { el.innerHTML = '<p class="vacio">Sin palabras que se repitan con estos filtros. Prueba con otro mes o quita un filtro.</p>'; el.style.height = ''; return; }
  el.style.height = d.alto + 'px';
  el.innerHTML = d.cajas.map(function (c) {
    var p = c.p, op = p.nNota < 5 ? .55 : 1;
    return '<button type="button" class="nb-p' + (o.sel === p.key ? ' sel' : '') + '" data-k="' + escH(p.key) + '" data-i="' + c.i + '"' +
      ' style="left:' + c.r.x.toFixed(1) + 'px;top:' + c.r.y.toFixed(1) + 'px;font-size:' + c.px + 'px;font-weight:' + c.peso + ';--c:' + colorNota(p.nota, an.prom) + ';opacity:' + op + '"' +
      ' aria-label="' + escH(p.t) + ': ' + p.n + ' comentarios' + (o.etqNota && p.nota != null ? ', ' + escH(o.etqNota(p)) : '') + '. Ver comentarios">' + escH(p.t) + '</button>';
  }).join('') + (d.ocultas ? '<span class="nb-ocultas">+' + d.ocultas + ' palabras que no cupieron</span>' : '');
  el.querySelectorAll('.nb-p').forEach(function (b) {
    b.addEventListener('click', function () { if (o.onElegir) o.onElegir(an.palabras.filter(function (p) { return p.key === b.getAttribute('data-k'); })[0], b); });
  });
  var M = window.Motion, reducir = false;
  try { reducir = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reducir = false; }
  if (M && !reducir && !o.quieto && !document.documentElement.hasAttribute('data-sin-anim')) {
    // Entran desde el centro, la más mencionada primero; al final cada una vuelve a su opacidad (las de poca muestra, más tenues)
    var bs = [].slice.call(el.querySelectorAll('.nb-p')), ops = bs.map(function (b) { return b.style.opacity; });
    bs.forEach(function (b) { b.style.transform = 'scale(.3)'; b.style.opacity = '0'; });
    var go = function () {
      M.animate(bs, {opacity: [0, 1], transform: ['scale(.3)', 'scale(1)']}, {duration: .5, delay: M.stagger(.018), ease: [.34, 1.56, .64, 1]});
      setTimeout(function () { bs.forEach(function (b, j) { b.style.transform = ''; b.style.opacity = ops[j]; }); }, 700 + bs.length * 18);
    };
    if (M.inView) M.inView(el, go, {amount: .15}); else go();
  }
}

// Resalta la palabra (o su raíz) dentro del texto ya escapado
function marcar(texto, key) {
  var partes = key.split(' ');
  var t = escH(texto);
  partes.forEach(function (p) {
    if (CABEZA[p]) return;
    var re = new RegExp('(^|[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ])(' + p.split('').map(function (ch) {
      var m = {a: '[aáAÁ]', e: '[eéEÉ]', i: '[iíIÍ]', o: '[oóOÓ]', u: '[uúüUÚÜ]', n: '[nN]'}; return m[ch] || '[' + ch + ch.toUpperCase() + ']';
    }).join('') + '[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{0,6})', 'g');
    t = t.replace(re, '$1<mark>$2</mark>');
  });
  return t;
}

// ------------------------------------------------------------------ componente completo: categorías + nube + pestaña de comentarios
// el = contenedor vacío. o = {
//   items: comentarios ya filtrados (con .texto), cfg: {categorias, stop, unir, nota, otros},
//   meta: v => html de la línea de datos del comentario (nota, negocio, mes…), chip: v => html del chip de nota,
//   etqNota: x (0..1) => texto de la nota media («NPS medio 3,2»), escala: [texto peor, texto mejor] para la leyenda,
//   estado: objeto que se conserva entre repintados ({cat, sel}) }
function montar(el, o) {
  var st = o.estado || {};
  var base = o.items, cfg = o.cfg;
  var anTodo = analizar(base, cfg);
  if (st.cat && !anTodo.cats.some(function (c) { return c.k === st.cat; })) st.cat = null;
  var items = st.cat ? base.filter(function (v) { return preparar(v, cfg).cats.indexOf(st.cat) >= 0; }) : base;
  var an = st.cat ? analizar(items, cfg) : anTodo;
  var nomCat = {}; anTodo.cats.forEach(function (c) { nomCat[c.k] = c.nombre; });
  var cats = anTodo.cats.slice().sort(function (a, b) { return (a.k === '_otros') - (b.k === '_otros') || b.n - a.n; });
  var fila = function (c) {
    return '<button type="button" class="nb-cat' + (st.cat === c.k ? ' sel' : '') + '" data-c="' + escH(c.k) + '" aria-pressed="' + (st.cat === c.k) + '">' +
      '<i style="background:' + colorNota(c.nota, anTodo.prom) + '"></i><span class="nb-cat-n">' + escH(c.nombre) + '</span>' +
      '<b>' + GRAF.num(c.pct, 0) + ' %</b><small>' + GRAF.num(c.n, 0) + '</small>' +
      '<span class="nb-cat-b"><em style="width:' + Math.min(100, c.pct) + '%;background:' + colorNota(c.nota, anTodo.prom) + '"></em></span></button>';
  };
  // Leyenda: la escala es relativa a la nota media de lo que se está viendo
  var ley = an.prom == null ? '' : '<span>Peor que el promedio</span><i></i><span>Mejor</span><em>Promedio: ' + escH(o.etqNota ? o.etqNota(an.prom) : GRAF.num(an.prom * 10, 1)) + '</em>';
  el.innerHTML = '<div class="nb">' +
    '<aside class="nb-cats" aria-label="Categorías"><h3>Categorías</h3><p class="nota">% de comentarios que tocan cada tema (uno puede tocar varios). Clic para ver solo ese tema.</p>' +
    '<button type="button" class="nb-cat todas' + (!st.cat ? ' sel' : '') + '" data-c="" aria-pressed="' + !st.cat + '"><span class="nb-cat-n">Todos los temas</span><b>' + GRAF.num(anTodo.total, 0) + '</b><small>comentarios</small></button>' +
    cats.map(fila).join('') + '</aside>' +
    '<div class="nb-lado"><div class="nb-cab"><div><b>' + (st.cat ? escH(nomCat[st.cat]) : 'Palabras que más se repiten') + '</b>' +
    '<span class="nota">' + GRAF.num(an.total, 0) + ' comentarios · tamaño = cuántos la mencionan · color = su nota frente al promedio · clic en una palabra para leer los comentarios</span></div>' +
    '<div class="nb-ley">' + ley + '</div></div>' +
    '<div class="nb-nube" role="group" aria-label="Nube de palabras"></div></div>' +
    '<div class="nb-pop" role="dialog" aria-modal="false" hidden></div></div>';
  var nube = el.querySelector('.nb-nube'), pop = el.querySelector('.nb-pop');
  var abrir = function (p, boton) {
    if (!p) return;
    st.sel = p.key;
    el.querySelectorAll('.nb-p').forEach(function (b) { b.classList.toggle('sel', b === boton); });
    nube.classList.add('con-sel');
    var sim = similares(items, p.key, cfg, {df: an.df, max: 8});
    var cd = []; for (var c in p.catDe) if (nomCat[c]) cd.push([c, p.catDe[c]]);
    cd.sort(function (a, b) { return b[1] - a[1]; });
    pop.innerHTML = '<header><div><span class="nota">' + (cd.length ? cd.slice(0, 2).map(function (x) { return escH(nomCat[x[0]]); }).join(' · ') : '') + '</span>' +
      '<h4 style="color:' + colorNota(p.nota, an.prom) + '">' + escH(p.t) + '</h4>' +
      '<p>' + GRAF.num(sim.n, 0) + ' comentarios' + (p.nota != null && o.etqNota ? ' · ' + escH(o.etqNota(p.nota)) : '') + '</p></div>' +
      '<button type="button" class="nb-x" aria-label="Cerrar">×</button></header>' +
      '<p class="nota nb-pop-ayuda">Primero lo que más se repite; los comentarios casi iguales van juntos.</p>' +
      '<ol>' + sim.grupos.map(function (g) {
        var v = g.rep.v, rep = g.miembros.length;
        return '<li><div class="nb-com-c">' + (o.chip ? o.chip(v) : '') + (rep > 1 ? '<span class="nb-rep" title="Comentarios casi iguales">×' + rep + '</span>' : '') + '</div>' +
          '<q>' + marcar(v.texto, p.key) + '</q>' + (o.meta ? '<div class="nb-meta">' + o.meta(v) + '</div>' : '') + '</li>';
      }).join('') + '</ol>';
    pop.hidden = false;
    // Se ubica junto a la palabra, dentro del componente
    var rb = boton.getBoundingClientRect(), rc = el.getBoundingClientRect(), W = Math.min(440, rc.width - 16);
    pop.style.width = W + 'px';
    var x = rb.left - rc.left + rb.width / 2 - W / 2; x = Math.max(8, Math.min(rc.width - W - 8, x));
    pop.style.left = x + 'px';
    pop.style.top = (rb.bottom - rc.top + 10) + 'px';
    var M = window.Motion;
    if (M && !document.documentElement.hasAttribute('data-sin-anim')) {
      try { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) M.animate(pop, {opacity: [0, 1], transform: ['translateY(-6px) scale(.97)', 'translateY(0) scale(1)']}, {duration: .25, ease: [.22, 1, .36, 1]}); } catch (e) { /* sin animación */ }
    }
    pop.querySelector('.nb-x').onclick = function () { cerrar(true); };
    pop.querySelector('.nb-x').focus({preventScroll: true});
    var top = pop.getBoundingClientRect();
    if (top.bottom > innerHeight) scrollBy({top: Math.min(top.bottom - innerHeight + 16, top.top - 80), behavior: 'smooth'});
  };
  var cerrar = function (foco) {
    if (pop.hidden) return;
    pop.hidden = true; nube.classList.remove('con-sel');
    var b = st.sel ? nube.querySelector('.nb-p[data-k="' + (window.CSS && CSS.escape ? CSS.escape(st.sel) : st.sel) + '"]') : null;
    el.querySelectorAll('.nb-p.sel').forEach(function (x) { x.classList.remove('sel'); });
    st.sel = null;
    if (foco && b) b.focus();
  };
  pintar(nube, an, {sel: st.sel, etqNota: o.etqNota ? function (p) { return o.etqNota(p.nota); } : null, onElegir: function (p, b) { if (st.sel === p.key && !pop.hidden) cerrar(true); else abrir(p, b); }, quieto: o.quieto});
  el.querySelectorAll('.nb-cat').forEach(function (b) { b.onclick = function () { st.cat = b.getAttribute('data-c') || null; st.sel = null; montar(el, Object.assign({}, o, {estado: st})); }; });
  el._nbCerrar = cerrar;
  if (!el._nbTecla) { el._nbTecla = true; el.addEventListener('keydown', function (e) { if (e.key === 'Escape' && el._nbCerrar) el._nbCerrar(true); }); }
  if (!el._nbClic) {   // clic fuera de la pestaña la cierra (una sola vez por contenedor)
    el._nbClic = true;
    document.addEventListener('mousedown', function (e) { var p = el.querySelector('.nb-pop'); if (p && !p.hidden && !p.contains(e.target) && !e.target.closest('.nb-p')) { p.hidden = true; var n = el.querySelector('.nb-nube'); if (n) n.classList.remove('con-sel'); el.querySelectorAll('.nb-p.sel').forEach(function (x) { x.classList.remove('sel'); }); if (el._nbEstado) el._nbEstado.sel = null; } });
  }
  el._nbEstado = st;
  if (st.sel) { var b0 = nube.querySelector('.nb-p[data-k="' + st.sel.replace(/"/g, '') + '"]'); if (b0) abrir(an.palabras.filter(function (p) { return p.key === st.sel; })[0], b0); else st.sel = null; }
  return st;
}

window.NUBE = {montar: montar, norm: norm, raiz: raiz, clave: clave, preparar: preparar, analizar: analizar, similares: similares, pintar: pintar, marcar: marcar, colorNota: colorNota};
})();
