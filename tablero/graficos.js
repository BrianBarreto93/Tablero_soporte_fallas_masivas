/* graficos.js · gráficos animados compartidos (tableros Factura, pago y cobro / Soporte y Fallas masivas).
   El MISMO archivo va en los tres tableros (Factura, Soporte-FM y Digital): si se cambia uno, copiarlo a los otros.

   Idea: cada constructor devuelve HTML/SVG ya en su estado FINAL (así se ve bien sin animación, en Tableau, al imprimir
   y con «reducir movimiento»). GRAF.animar(raiz) pone el estado inicial antes del primer cuadro y, cuando el panel entra
   en pantalla, Motion (vendor/motion.js) lo lleva al final. Sin Motion no se anima nada y todo queda igual de legible.

   Color evaluativo: rampa de 9 tonos --t0 (rojo intenso, lo peor) → --t8 (verde sobrio, lo mejor), definida por tema en
   graficos.css. Se usa solo para codificar «qué tan bueno»; Hogar/Móvil y Soporte/FM conservan sus colores de serie.
   Se incrusta en Tableau (Chromium viejo): sin .at(), ||=, ??=, ?., replaceAll ni structuredClone. */
'use strict';
(function () {
var M = window.Motion || null;
var reducir = false;
try { reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reducir = false; }

// ------------------------------------------------------------------ formato es-CO
var nf = {};
function num(v, d) {
  d = d == null ? 1 : d;
  if (!nf[d]) nf[d] = new Intl.NumberFormat('es-CO', {minimumFractionDigits: d, maximumFractionDigits: d});
  return nf[d].format(v).replace('-', '−');
}
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
var tipFn = function (html) { return 'data-tip="' + esc(html) + '"'; };
function tip(html) { return html ? tipFn(html) : ''; }

// ------------------------------------------------------------------ rampa rojo → verde
var NT = 9;
function lim(x, a, b) { return Math.max(a, Math.min(b, x)); }
function idx(t) { return Math.round(lim(t, 0, 1) * (NT - 1)); }
// t ∈ [0,1]: 0 = lo peor (rojo intenso), 1 = lo mejor (verde sobrio)
function tono(t) { return 'var(--t' + idx(t) + ')'; }
// Texto legible encima de un tono
// Texto legible encima de un tono: lo define cada tema en graficos.css (--ti0…--ti8), así sirve al cambiar de tema sin repintar
function tinta(t) { return 'var(--ti' + idx(t) + ')'; }
function tonoV(v, min, max) { return tono((v - min) / (max - min)); }
// Diferencia contra una referencia: ±rango → rojo / verde, 0 → ámbar del centro
// Una diferencia de al menos 0,05 nunca cae en el ámbar del centro: coincide con «mejora» / «empeora»
function tonoDif(d, rango) { var t = .5 + d / (2 * (rango || 20)); if (Math.abs(d) < .05) t = .5; else if (d > 0) t = Math.max(.62, t); else t = Math.min(.38, t); return tono(t); }
// Escala de una pregunta de k opciones (k = 2, 3 o 5): de la peor a la mejor
function tonosEscala(k) {
  if (k === 2) return [tono(0), tono(1)];
  if (k === 3) return [tono(0), tono(.5), tono(1)];
  var r = []; for (var i = 0; i < k; i++) r.push(tono(i / (k - 1))); return r;
}
function tintaEscala(k) { var r = []; for (var i = 0; i < k; i++) r.push(tinta(k === 1 ? 1 : i / (k - 1))); return r; }
// Gradiente SVG vertical de la rampa entre lo y hi (para el eje Y del gráfico de líneas)
function gradY(id, lo, hi, min, max) {
  var s = '<linearGradient id="' + id + '" x1="0" y1="1" x2="0" y2="0">';
  for (var i = 0; i <= 8; i++) { var v = lo + (hi - lo) * i / 8; s += '<stop offset="' + (i / 8) + '" style="stop-color:' + tonoV(v, min, max) + '"/>'; }
  return s + '</linearGradient>';
}
// Gradiente de relleno bajo una línea (color de serie que se desvanece)
function gradArea(id, color, alfa) {
  return '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:' + color + ';stop-opacity:' + (alfa == null ? .16 : alfa) + '"/><stop offset="1" style="stop-color:' + color + ';stop-opacity:0"/></linearGradient>';
}

// ------------------------------------------------------------------ piezas
// Cifra que cuenta desde 0 (o desde «desde») hasta v al entrar en pantalla
function cuenta(v, d, o) {
  o = o || {};
  d = d == null ? 1 : d;
  var txt = (o.signo && v > 0 ? '+' : '') + num(v, d);
  return '<span class="g-cuenta" data-an="cuenta" data-v="' + v + '" data-d="' + d + '"' + (o.signo ? ' data-signo="1"' : '') + (o.desde != null ? ' data-desde="' + o.desde + '"' : '') + '>' + txt + '</span>';
}

// Anillo medidor: arco de min a max coloreado según el valor. o = {tam, grosor, tip, centro}
function anillo(v, min, max, o) {
  o = o || {};
  var T = o.tam || 56, g = o.grosor || 6, r = (T - g) / 2 - 1, c = T / 2, p = lim((v - min) / (max - min), 0, 1) * 100;
  var col = tono(p / 100);
  var cero = min < 0 ? '<line x1="' + c + '" y1="' + (c + r - g / 2 - 1) + '" x2="' + c + '" y2="' + (c + r + g / 2 + 1) + '" class="g-cero"/>' : '';
  return '<svg class="g-anillo" viewBox="0 0 ' + T + ' ' + T + '" width="' + T + '" height="' + T + '" ' + tip(o.tip) + ' aria-hidden="true">' +
    '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" class="g-pista" stroke-width="' + g + '"/>' +
    '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" pathLength="100" stroke-width="' + g + '" stroke-linecap="round" transform="rotate(-90 ' + c + ' ' + c + ')"' +
    ' style="stroke:' + col + ';stroke-dasharray:' + p.toFixed(2) + ' 100;fill:none" data-an="arco" data-da="' + p.toFixed(2) + ' 100"/>' + cero +
    (o.centro ? '<text x="' + c + '" y="' + (c + 4) + '" text-anchor="middle" class="g-anillo-t">' + o.centro + '</text>' : '') + '</svg>';
}

// Curva suave que pasa por todos los puntos sin pasarse de ellos (cúbica monótona, Fritsch–Carlson): no inventa picos
// ni valles entre un mes y otro. p = [[x, y], …] ya en píxeles.
function curva(p) {
  var n = p.length, f = function (v) { return v.toFixed(1); };
  if (!n) return '';
  var d = 'M' + f(p[0][0]) + ' ' + f(p[0][1]);
  if (n === 1) return d;
  if (n === 2) return d + ' L' + f(p[1][0]) + ' ' + f(p[1][1]);
  var dx = [], m = [], t = [], i;
  for (i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0] || 1e-6; m[i] = (p[i + 1][1] - p[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    var a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) { var k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  for (i = 0; i < n - 1; i++) {
    var c = dx[i] / 3;
    d += ' C' + f(p[i][0] + c) + ' ' + f(p[i][1] + t[i] * c) + ' ' + f(p[i + 1][0] - c) + ' ' + f(p[i + 1][1] - t[i + 1] * c) + ' ' + f(p[i + 1][0]) + ' ' + f(p[i + 1][1]);
  }
  return d;
}

// Spark de área: series = [{color, pts:[{i, v}]}], n = total de posiciones, marcas = posiciones resaltadas.
// Curva suave, área en degradado y un punto que late al final de cada serie (HTML encima del SVG estirado, para que
// el punto no se deforme).
var nId = 0;
function spark(series, n, marcas, o) {
  o = o || {};
  var W = 200, H = o.alto || 40, all = [];
  series.forEach(function (s) { s.pts.forEach(function (p) { all.push(p.v); }); });
  if (!all.length) return '';
  var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), rg = hi - lo || 1;
  var X = function (i) { return 4 + (W - 8) * i / Math.max(1, n - 1); }, Y = function (v) { return 5 + (H - 10) * (1 - (v - lo) / rg); };
  var s = '<svg class="spark g-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><defs>';
  var ids = series.map(function (sr) { var id = 'gsa' + (++nId); s += gradArea(id, sr.color, .3); return id; });
  s += '</defs>';
  (marcas || []).forEach(function (m) { s += '<line x1="' + X(m) + '" x2="' + X(m) + '" y1="0" y2="' + H + '" class="g-marca" vector-effect="non-scaling-stroke"/>'; });
  var pts = '';
  series.forEach(function (sr, k) {
    if (sr.pts.length < 2) return;
    // tramos: la línea se corta donde faltan periodos (no se dibuja un tramo inventado)
    var tr = [];
    sr.pts.forEach(function (p, j) { if (!j || p.i - sr.pts[j - 1].i > 1) tr.push([]); tr[tr.length - 1].push(p); });
    var linea = function (t) { return curva(t.map(function (p) { return [X(p.i), Y(p.v)]; })); };
    var d = tr.map(linea).join(' ');
    var a = tr.filter(function (t) { return t.length > 1; }).map(function (t) { return linea(t) + ' L' + X(t[t.length - 1].i).toFixed(1) + ' ' + H + ' L' + X(t[0].i).toFixed(1) + ' ' + H + ' Z'; }).join(' ');
    if (a) s += '<path d="' + a + '" style="fill:url(#' + ids[k] + ')" data-an="aparece" data-i="' + (k + 2) + '"/>';
    s += '<path d="' + d + '" pathLength="1" style="fill:none;stroke:' + sr.color + ';stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round" vector-effect="non-scaling-stroke" data-an="traza" data-i="' + k + '"/>';
    var u = sr.pts[sr.pts.length - 1];
    pts += '<i class="g-spark-pt" style="left:' + (X(u.i) / W * 100).toFixed(2) + '%;top:' + (Y(u.v) / H * 100).toFixed(2) + '%;--c:' + sr.color + '" data-an="pop" data-i="' + (k + 14) + '"></i>';
  });
  return '<div class="g-spark-w">' + s + '</svg>' + pts + '</div>';
}

// Riel con la rampa de fondo (para pesas): devuelve el estilo inline del riel
function rampaCss(alfa) { return 'background:linear-gradient(90deg,var(--t0),var(--t2),var(--t4),var(--t6),var(--t8));opacity:' + (alfa == null ? .35 : alfa); }

// Leyenda con cuadritos
function leyenda(etqs, cols, extra) {
  return '<div class="leyenda g-ley">' + etqs.map(function (t, i) { return '<span><i style="background:' + cols[i] + '"></i>' + esc(t) + '</span>'; }).join('') + (extra || '') + '</div>';
}

// ------------------------------------------------------------------ distribuciones
// grupos = [{nombre, sub, cuentas:[...], fin (html a la derecha), tip?}]  etiquetas = nombre de cada opción (peor → mejor)

// Barras divergentes centradas en la opción neutra (escala impar) o entre las dos del medio
function divergente(grupos, etiquetas, o) {
  o = o || {};
  var k = etiquetas.length, cols = o.tonos || tonosEscala(k), ink = tintaEscala(k), mid = (k - 1) / 2;
  var P = grupos.map(function (g) {
    var n = g.cuentas.reduce(function (x, y) { return x + y; }, 0);
    return {g: g, n: n, p: g.cuentas.map(function (x) { return n ? x / n * 100 : 0; })};
  }).filter(function (x) { return x.n; });
  if (!P.length) return '<p class="vacio">Sin respuestas con estos filtros</p>';
  var izqDe = function (x) { var s = 0; for (var i = 0; i < k; i++) s += i < mid ? x.p[i] : i === mid ? x.p[i] / 2 : 0; return s; };
  var derDe = function (x) { var s = 0; for (var i = 0; i < k; i++) s += i > mid ? x.p[i] : i === mid ? x.p[i] / 2 : 0; return s; };
  var izq = Math.max.apply(null, P.map(izqDe)), der = Math.max.apply(null, P.map(derDe)), tot = izq + der;
  return leyenda(etiquetas, cols) + '<div class="g-div">' + P.map(function (x, gi) {
    var off = (izq - izqDe(x)) / tot * 100, nom = esc(x.g.nombre);
    var segs = x.p.map(function (p, i) {
      var w = p / tot * 100, orig = i < mid ? 'r' : i > mid ? 'l' : 'c';
      return '<span' + (i === k - 1 ? ' class="g-u"' : '') + ' style="width:' + w + '%;background:' + cols[i] + ';color:' + ink[i] + '" data-an="barra" data-o="' + orig + '" data-i="' + (gi * 2 + Math.abs(i - mid)) + '" ' +
        tip('<div class="t">' + nom + ' · ' + esc(etiquetas[i]) + '</div>' + num(p) + ' % (' + num(x.g.cuentas[i], 0) + ' de ' + num(x.n, 0) + ')') + '>' + (w > 7 ? num(p, 0) + '%' : '') + '</span>';
    }).join('');
    return '<div class="apil g-fila"><div class="et">' + nom + '<small>' + (x.g.sub != null ? x.g.sub : 'n ' + num(x.n, 0)) + '</small></div>' +
      '<div class="tira g-tira" role="img" aria-label="' + nom + ': ' + etiquetas.map(function (e, i) { return esc(e) + ' ' + num(x.p[i]) + ' %'; }).join(', ') + '">' + (off > 0 ? '<span class="g-hueco" style="width:' + off + '%"></span>' : '') + segs +
      '<span class="centro g-centro" style="left:' + (izq / tot * 100) + '%"></span></div><div class="fin">' + (x.g.fin || '') + '</div></div>';
  }).join('') + '</div>';
}

// Waffle de 100 cuadritos por grupo (cada uno = 1 %). Reparto por mayor residuo para que sumen 100.
function cien(cuentas) {
  var n = cuentas.reduce(function (x, y) { return x + y; }, 0) || 1, q = cuentas.map(function (c) { return c / n * 100; });
  var b = q.map(Math.floor), falta = 100 - b.reduce(function (x, y) { return x + y; }, 0);
  q.map(function (x, i) { return [x - b[i], i]; }).sort(function (a, c) { return c[0] - a[0]; }).slice(0, falta).forEach(function (r) { b[r[1]]++; });
  return b;
}
function waffle(grupos, etiquetas, o) {
  o = o || {};
  var k = etiquetas.length, cols = o.tonos || tonosEscala(k);
  var gs = grupos.filter(function (g) { return g.cuentas.reduce(function (x, y) { return x + y; }, 0); });
  if (!gs.length) return '<p class="vacio">Sin respuestas con estos filtros</p>';
  return leyenda(etiquetas, cols) + '<div class="g-waffles">' + gs.map(function (g) {
    var n = g.cuentas.reduce(function (x, y) { return x + y; }, 0), c = cien(g.cuentas), celdas = '';
    c.forEach(function (m, i) {
      var t = '<div class="t">' + esc(g.nombre) + ' · ' + esc(etiquetas[i]) + '</div>' + num(g.cuentas[i] / n * 100) + ' % (' + num(g.cuentas[i], 0) + ' de ' + num(n, 0) + ')';
      for (var j = 0; j < m; j++) celdas += '<i style="background:' + cols[i] + '" ' + tip(t) + '></i>';
    });
    return '<figure class="g-waffle" role="img" aria-label="' + esc(g.nombre) + ': ' + etiquetas.map(function (e, i) { return esc(e) + ' ' + num(g.cuentas[i] / n * 100) + ' %'; }).join(', ') + '">' +
      '<figcaption><b>' + esc(g.nombre) + '</b><small>' + (g.sub != null ? g.sub : 'n ' + num(n, 0)) + '</small></figcaption>' +
      '<div class="g-celdas" data-an="celdas">' + celdas + '</div>' +
      '<div class="g-waffle-pie">' + etiquetas.map(function (e, i) { return '<span style="--c:' + cols[i] + '">' + c[i] + '%</span>'; }).join('') + '</div>' +
      (g.fin ? '<div class="g-fin">' + g.fin + '</div>' : '') + '</figure>';
  }).join('') + '</div>';
}

// Donas: anillo partido por opción; en el centro el % de la opción «destacada» (por defecto la última = la buena)
function donas(grupos, etiquetas, o) {
  o = o || {};
  var k = etiquetas.length, cols = o.tonos || tonosEscala(k), dest = o.destacada == null ? k - 1 : o.destacada;
  var gs = grupos.filter(function (g) { return g.cuentas.reduce(function (x, y) { return x + y; }, 0); });
  if (!gs.length) return '<p class="vacio">Sin respuestas con estos filtros</p>';
  var T = 132, g0 = 16, r = (T - g0) / 2 - 2, c = T / 2;
  return leyenda(etiquetas, cols) + '<div class="g-donas">' + gs.map(function (g, gi) {
    var n = g.cuentas.reduce(function (x, y) { return x + y; }, 0), acc = 0, segs = '';
    g.cuentas.forEach(function (x, i) {
      var p = x / n * 100; if (!p) return;
      var hueco = gs.length && p < 100 ? Math.min(1.2, p / 3) : 0;   // separación entre tramos
      segs += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" pathLength="100" stroke-width="' + g0 + '" transform="rotate(' + (-90 + acc * 3.6) + ' ' + c + ' ' + c + ')"' +
        ' style="stroke:' + cols[i] + ';fill:none;stroke-dasharray:' + (p - hueco).toFixed(2) + ' 100" data-an="arco" data-da="' + (p - hueco).toFixed(2) + ' 100" data-i="' + (gi * 2 + i) + '" ' +
        tip('<div class="t">' + esc(g.nombre) + ' · ' + esc(etiquetas[i]) + '</div>' + num(p) + ' % (' + num(x, 0) + ' de ' + num(n, 0) + ')') + '/>';
      acc += p;
    });
    var pd = g.cuentas[dest] / n * 100;
    return '<figure class="g-dona" role="img" aria-label="' + esc(g.nombre) + ': ' + etiquetas.map(function (e, i) { return esc(e) + ' ' + num(g.cuentas[i] / n * 100) + ' %'; }).join(', ') + '">' +
      '<div class="g-dona-svg"><svg viewBox="0 0 ' + T + ' ' + T + '" aria-hidden="true"><circle cx="' + c + '" cy="' + c + '" r="' + r + '" class="g-pista" stroke-width="' + g0 + '"/>' + segs + '</svg>' +
      '<div class="g-dona-c"><b style="color:' + cols[dest] + '">' + cuenta(pd, o.dec == null ? 0 : o.dec) + '<small>%</small></b><span>' + esc(o.centro || etiquetas[dest]) + '</span></div></div>' +
      '<figcaption><b>' + esc(g.nombre) + '</b><small>' + (g.sub != null ? g.sub : 'n ' + num(n, 0)) + '</small>' + (g.fin ? '<div class="g-fin">' + g.fin + '</div>' : '') + '</figcaption></figure>';
  }).join('') + '</div>';
}

// Torres: columnas 100 % apiladas en vertical, la opción peor abajo
function torres(grupos, etiquetas, o) {
  o = o || {};
  var k = etiquetas.length, cols = o.tonos || tonosEscala(k), ink = tintaEscala(k);
  var gs = grupos.filter(function (g) { return g.cuentas.reduce(function (x, y) { return x + y; }, 0); });
  if (!gs.length) return '<p class="vacio">Sin respuestas con estos filtros</p>';
  return leyenda(etiquetas, cols) + '<div class="g-torres">' + gs.map(function (g, gi) {
    var n = g.cuentas.reduce(function (x, y) { return x + y; }, 0);
    var segs = g.cuentas.map(function (x, i) {
      var p = x / n * 100;
      return '<span style="height:' + p + '%;background:' + cols[i] + ';color:' + ink[i] + '" data-an="alto" data-i="' + (gi * 3 + i) + '" ' +
        tip('<div class="t">' + esc(g.nombre) + ' · ' + esc(etiquetas[i]) + '</div>' + num(p) + ' % (' + num(x, 0) + ' de ' + num(n, 0) + ')') + '>' + (p >= 9 ? num(p, 0) + '%' : '') + '</span>';
    }).join('');
    return '<figure class="g-torre" role="img" aria-label="' + esc(g.nombre) + ': ' + etiquetas.map(function (e, i) { return esc(e) + ' ' + num(g.cuentas[i] / n * 100) + ' %'; }).join(', ') + '">' +
      (g.fin ? '<div class="g-fin">' + g.fin + '</div>' : '') + '<div class="g-torre-c">' + segs + '</div><figcaption><b>' + esc(g.nombre) + '</b><small>' + (g.sub != null ? g.sub : 'n ' + num(n, 0)) + '</small></figcaption></figure>';
  }).join('') + '</div>';
}

// ------------------------------------------------------------------ motivos y temas: paletas (lollipop)
// items = [{nombre, c, cod?}], base = encuestas sobre las que se saca el %. El tono se enciende con la frecuencia (más = más rojo).
function paletas(items, base, o) {
  o = o || {};
  if (!items.length || !base) return '<p class="vacio">Sin datos</p>';
  var max = Math.max.apply(null, items.map(function (x) { return x.c; }));
  return '<div class="g-paletas">' + items.map(function (x, i) {
    var p = x.c / base * 100, w = x.c / max * 100, col = x.cod ? 'var(--ink-3)' : o.color ? o.color(x) : tono(.42 * (1 - x.c / max));
    return '<div class="g-paleta' + (x.cod ? ' cod' : '') + '" ' + tip('<div class="t">' + esc(x.nombre) + '</div>' + num(x.c, 0) + ' de ' + num(base, 0) + ' (' + num(p) + ' %)') + '>' +
      '<span class="et" title="' + esc(x.nombre) + '">' + esc(x.nombre) + '</span>' +
      '<span class="g-pal-p"><b style="width:' + w + '%;--c:' + col + '" data-an="ancho" data-i="' + i + '"><i></i></b></span>' +
      '<span class="num">' + cuenta(p, 1) + ' %<small>' + num(x.c, 0) + '</small></span></div>';
  }).join('') + '</div>';
}

// ------------------------------------------------------------------ canales: barras radiales
// items = [{nombre, c}] ordenados de mayor a menor; base = total. Arco máximo = 270°.
function radial(items, base, o) {
  o = o || {};
  if (!items.length || !base) return '<p class="vacio">Sin datos</p>';
  var its = items.slice(0, 7), max = Math.max.apply(null, its.map(function (x) { return x.c; }));
  var g0 = 11, sep = 5, R = 30 + its.length * (g0 + sep), T = 2 * R + 8, c = T / 2;
  var arcos = '', etq = '';
  its.forEach(function (x, i) {
    var r = R - i * (g0 + sep) - g0 / 2, p = x.c / max * 75, col = o.color ? o.color(x, i) : 'var(--cat)';
    var op = 1 - i * .1;
    arcos += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" pathLength="100" class="g-pista" stroke-width="' + g0 + '" style="stroke-dasharray:75 100" transform="rotate(-90 ' + c + ' ' + c + ')"/>';
    arcos += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" pathLength="100" stroke-width="' + g0 + '" stroke-linecap="round" transform="rotate(-90 ' + c + ' ' + c + ')"' +
      ' style="stroke:' + col + ';opacity:' + op + ';fill:none;stroke-dasharray:' + p.toFixed(2) + ' 100" data-an="arco" data-da="' + p.toFixed(2) + ' 100" data-i="' + i + '" ' +
      tip('<div class="t">' + esc(x.nombre) + '</div>' + num(x.c, 0) + ' de ' + num(base, 0) + ' (' + num(x.c / base * 100) + ' %)') + '/>';
    etq += '<li style="--c:' + col + ';--o:' + op + '" data-an="aparece" data-i="' + i + '"><i></i><span>' + esc(x.nombre) + '</span><b>' + num(x.c / base * 100) + ' %</b><small>' + num(x.c, 0) + '</small></li>';
  });
  var resto = items.length - its.length;
  return '<div class="g-radial"><svg viewBox="0 0 ' + T + ' ' + T + '" role="img" aria-label="' + its.map(function (x) { return esc(x.nombre) + ' ' + num(x.c / base * 100) + ' %'; }).join(', ') + '">' + arcos + '</svg>' +
    '<ol class="g-radial-l">' + etq + '</ol></div>' + (resto > 0 ? '<p class="nota">Y ' + resto + ' más con menos encuestas.</p>' : '');
}

// ------------------------------------------------------------------ brecha: NPS de la buena condición frente a la mala, en barras
// Barras horizontales desde 0 (verde a la derecha si es positivo, rojo a la izquierda si es negativo) y una frase con la diferencia.
// grupos = [{nombre, sub, bueno:{v,n}|null, malo:{v,n}|null}]; o = {etqBueno, etqMalo, unidad}
function brecha(grupos, o) {
  var fila = function (g, r, etq, cls, i) {
    if (!r) return '<div class="g-br-fila"><span class="et">' + esc(etq) + '</span><span class="g-br-pista"></span><span class="num">—</span></div>';
    var w = Math.min(Math.abs(r.v), 100) / 2, lado = r.v < 0 ? 'right' : 'left';
    return '<div class="g-br-fila" ' + tip('<div class="t">' + esc(g.nombre) + ' · ' + esc(etq) + '</div>NPS ' + num(r.v) + ' · ' + num(r.n, 0) + ' respuestas') + '>' +
      '<span class="et"><i class="' + cls + '"></i>' + esc(etq) + '</span>' +
      '<span class="g-br-pista"><b class="' + cls + '" style="' + lado + ':50%;width:' + w + '%" data-an="ancho" data-i="' + i + '"></b></span>' +
      '<span class="num">' + cuenta(r.v, 1) + '<small>' + num(r.n, 0) + ' resp.</small></span></div>';
  };
  return '<div class="g-brecha"><div class="g-br-gs">' +
    grupos.map(function (g, gi) {
      var b = g.bueno, m = g.malo, d = b && m ? b.v - m.v : null;
      return '<div class="g-br-g"><div class="g-br-tit"><b>' + esc(g.nombre) + '</b>' + (g.sub ? '<small>' + g.sub + '</small>' : '') + '</div>' +
        fila(g, b, o.etqBueno, 'bueno', gi * 2) + fila(g, m, o.etqMalo, 'malo', gi * 2 + 1) +
        (d != null ? '<p class="g-br-frase">«' + esc(o.etqBueno) + '» queda <b>' + num(Math.abs(d)) + ' ' + esc(o.unidad) + ' ' + (d >= 0 ? 'por encima' : 'por debajo') + '</b> de «' + esc(o.etqMalo) + '».</p>' : '') + '</div>';
    }).join('') + '</div>' +
    '<p class="nota g-br-nota">La raya del centro es NPS 0. El NPS va de −100 (todos lo critican) a 100 (todos lo recomiendan): verde hacia la derecha, rojo hacia la izquierda.</p></div>';
}

// ------------------------------------------------------------------ relojes: atributos con dos anillos (uno por serie)
// items = [{nombre, series:[{e, color, r:{v,n}|null}]}]; el anillo exterior es la primera serie
function relojes(items, o) {
  o = o || {};
  return '<div class="g-relojes">' + items.map(function (it, ii) {
    var T = 124, g0 = 10, c = T / 2, svg = '', txt = '';
    it.series.forEach(function (s, si) {
      var r = c - 6 - si * (g0 + 6), p = s.r ? lim(s.r.v, 0, 100) : 0, col = s.r ? tono(p / 100) : 'var(--panel-3)';
      svg += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" class="g-pista" stroke-width="' + g0 + '"/>';
      if (s.r) svg += '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" pathLength="100" stroke-width="' + g0 + '" stroke-linecap="round" transform="rotate(-90 ' + c + ' ' + c + ')" style="stroke:' + col + ';fill:none;stroke-dasharray:' + p.toFixed(2) + ' 100" data-an="arco" data-da="' + p.toFixed(2) + ' 100" data-i="' + (ii + si) + '" ' +
        tip('<div class="t">' + esc(it.nombre) + ' · ' + esc(s.e) + '</div>' + num(s.r.v) + ' % califica 4–5 · n ' + num(s.r.n, 0)) + '/>';
      svg += '<circle cx="' + c + '" cy="' + (c - r) + '" r="3.2" style="fill:' + s.color + '" class="g-reloj-marca"/>';
      txt += '<span><i style="background:' + s.color + '"></i>' + esc(s.e) + '<b>' + (s.r ? num(s.r.v) + ' %' : '—') + '</b></span>';
    });
    return '<figure class="g-reloj" role="img" aria-label="' + esc(it.nombre) + ': ' + it.series.map(function (s) { return esc(s.e) + ' ' + (s.r ? num(s.r.v) + ' %' : 'sin datos'); }).join(', ') + '">' +
      '<svg viewBox="0 0 ' + T + ' ' + T + '" aria-hidden="true">' + svg + '</svg><figcaption><b>' + esc(it.nombre) + '</b>' + txt + '</figcaption></figure>';
  }).join('') + '</div>';
}

// ------------------------------------------------------------------ guía al pasar el cursor en el gráfico de líneas
// svg con <line class="g-guia-l"> y rects .hit con data-x; los puntos llevan data-x y se agrandan
function guia(raiz) {
  (raiz || document).querySelectorAll('svg[data-guia]').forEach(function (svg) {
    var l = svg.querySelector('.g-guia-l'); if (!l) return;
    svg.querySelectorAll('.hit[data-x]').forEach(function (h) {
      h.addEventListener('mouseenter', function () {
        var x = h.getAttribute('data-cx');
        l.setAttribute('x1', x); l.setAttribute('x2', x); l.classList.add('on');
        svg.querySelectorAll('.g-pt').forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-x') === h.getAttribute('data-x')); });
      });
    });
    svg.addEventListener('mouseleave', function () { l.classList.remove('on'); svg.querySelectorAll('.g-pt.on').forEach(function (p) { p.classList.remove('on'); }); });
  });
}

// ------------------------------------------------------------------ líneas con movimiento
// GRAF.lineas(el, o) dibuja dentro de el (con su tamaño real) una o varias series con curva suave, área en degradado,
// resplandor del color de la serie, etiqueta final en píldora y guía al pasar el cursor. Al entrar en pantalla la línea
// se traza de izquierda a derecha con un cometa que la va dibujando; cada punto aparece cuando la línea llega a él y la
// cifra final cuenta hasta su valor. Redibujar con los mismos datos (cambio de tamaño, tema) no repite la animación.
// o = {series:[{nombre, color, tinta?, total?, pts:[{x, v, n}]}], xs:[x ordenados], etq: x → texto del eje,
//      marcas:[x resaltados], min, max (escala del indicador), nmin, fmt: v → texto, tip: x → html, id, der: margen derecho}
var EASE_L = [.65, 0, .35, 1];
// Momento (0–1) en que una curva cubic-bezier(x1,0,x2,1) llega a la fracción f del recorrido
function cuandoLlega(f) {
  var bx = function (s) { return 3 * EASE_L[0] * s * (1 - s) * (1 - s) + 3 * EASE_L[2] * s * s * (1 - s) + s * s * s; };
  var by = function (s) { return 3 * s * s * (1 - s) + s * s * s; };
  var a = 0, b = 1;
  for (var i = 0; i < 24; i++) { var mm = (a + b) / 2; if (by(mm) < f) a = mm; else b = mm; }
  return bx((a + b) / 2);
}
function anchoTxt(t) { return String(t).length * 7 + 16; }
function lineas(el, o) {
  var W = el.clientWidth, H = el.clientHeight;
  if (!W || !H) return;
  var S = o.series.filter(function (s) { return s.pts.length; }), xs = o.xs;
  var L = 40, R = o.der || 74, T = 16, B = 28, yB = H - B;
  var vals = []; S.forEach(function (s) { s.pts.forEach(function (p) { vals.push(p.v); }); });
  var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = Math.max(4, (hi - lo) * .15);
  lo = Math.max(o.min, Math.floor((lo - pad) / 10) * 10); hi = Math.min(o.max, Math.ceil((hi + pad) / 10) * 10);
  if (hi === lo) hi = lo + 10;
  var X = function (i) { return xs.length === 1 ? (L + W - R) / 2 : L + (W - L - R) * i / (xs.length - 1); };
  var Y = function (v) { return T + (yB - T) * (1 - (v - lo) / (hi - lo)); };
  var paso = hi - lo > 60 ? 20 : 10, cada = Math.max(1, Math.ceil(xs.length / Math.max(2, Math.floor((W - L - R) / 56))));
  var id = 'ln-' + (o.id || ++nId), marcas = o.marcas || [];
  var s = '<svg class="ln" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true" data-guia><defs>' + gradY(id + '-y', lo, hi, o.min, o.max) +
    '<filter id="' + id + '-glow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="4.5"/></filter>';
  S.forEach(function (sr, j) {
    s += '<linearGradient id="' + id + '-a' + j + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:' + sr.color + ';stop-opacity:' + (sr.total ? .1 : .3) + '"/>' +
      '<stop offset=".55" style="stop-color:' + sr.color + ';stop-opacity:' + (sr.total ? .03 : .09) + '"/><stop offset="1" style="stop-color:' + sr.color + ';stop-opacity:0"/></linearGradient>';
  });
  s += '</defs><g class="ln-fondo">';
  // Meses elegidos: columna suave y su etiqueta en píldora
  marcas.forEach(function (m) { var i = xs.indexOf(m); if (i >= 0) s += '<rect class="ln-col" x="' + (X(i) - 19).toFixed(1) + '" y="' + (T - 8) + '" width="38" height="' + (yB - T + 14) + '" rx="19"/>'; });
  for (var v = Math.ceil(lo / paso) * paso; v <= hi; v += paso) s += '<line class="ln-grid" x1="' + L + '" x2="' + (W - R + 8) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text class="ln-ey" x="' + (L - 12) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + num(v, 0) + '</text>';
  s += '<rect class="g-rampa-y" x="' + (L - 6) + '" y="' + Y(hi).toFixed(1) + '" width="3.5" height="' + (Y(lo) - Y(hi)).toFixed(1) + '" rx="1.75" style="fill:url(#' + id + '-y)"/>';
  if (lo < 0 && hi > 0) s += '<line class="ln-cero" x1="' + L + '" x2="' + (W - R + 8) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '"/>';
  xs.forEach(function (x, i) {
    if (!(i % cada === 0 || i === xs.length - 1)) return;
    var t = esc(o.etq(x)), sel = marcas.indexOf(x) >= 0;
    if (sel) { var w = anchoTxt(t) - 4; s += '<rect class="ln-pil" x="' + (X(i) - w / 2).toFixed(1) + '" y="' + (H - 21) + '" width="' + w + '" height="18" rx="9"/>'; }
    s += '<text class="ln-ex' + (sel ? ' sel' : '') + '" x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + t + '</text>';
  });
  s += '</g><line class="g-guia-l" x1="0" x2="0" y1="' + (T - 6) + '" y2="' + yB + '"/>';
  // Posiciones por serie, partidas en tramos donde falta un periodo (no se inventa el tramo)
  var P = S.map(function (sr) {
    var pos = sr.pts.map(function (p) { return {x: X(xs.indexOf(p.x)), y: Y(p.v), i: xs.indexOf(p.x), p: p}; });
    var tr = []; pos.forEach(function (q, j) { if (!j || q.i - pos[j - 1].i > 1) tr.push([]); tr[tr.length - 1].push(q); });
    var d = tr.map(function (t) { return curva(t.map(function (q) { return [q.x, q.y]; })); }).join(' ');
    // fracción del recorrido hasta cada punto (por cuerdas; basta para sincronizar)
    var acc = [0], tot = 0; for (var j = 1; j < pos.length; j++) { tot += Math.sqrt(Math.pow(pos[j].x - pos[j - 1].x, 2) + Math.pow(pos[j].y - pos[j - 1].y, 2)); acc.push(tot); }
    return {sr: sr, pos: pos, tr: tr, d: d, frac: acc.map(function (a) { return tot ? a / tot : 0; })};
  });
  P.forEach(function (q, j) {
    if (q.sr.total) return;   // la serie total va sin área: taparía las de los estudios
    q.tr.filter(function (t) { return t.length > 1; }).forEach(function (t) {
      s += '<path class="ln-area" d="' + curva(t.map(function (z) { return [z.x, z.y]; })) + ' L' + t[t.length - 1].x.toFixed(1) + ' ' + yB + ' L' + t[0].x.toFixed(1) + ' ' + yB + ' Z" style="fill:url(#' + id + '-a' + j + ')" data-s="' + j + '"/>';
    });
  });
  P.forEach(function (q, j) {
    var w = q.sr.total ? 3.2 : 2.6;
    s += '<path class="ln-brillo" d="' + q.d + '" pathLength="1" style="stroke:' + q.sr.color + ';stroke-width:' + (w + 4) + '" filter="url(#' + id + '-glow)" data-s="' + j + '"/>';
    s += '<path class="ln-linea" d="' + q.d + '" pathLength="1" style="stroke:' + q.sr.color + ';stroke-width:' + w + '" data-s="' + j + '"/>';
  });
  P.forEach(function (q, j) {
    var u = q.pos[q.pos.length - 1];
    s += '<circle class="ln-halo" cx="' + u.x.toFixed(1) + '" cy="' + u.y.toFixed(1) + '" r="6" style="stroke:' + q.sr.color + '" data-s="' + j + '"/>';
    s += q.pos.map(function (z, k) {
      var hueco = o.nmin && z.p.n < o.nmin;
      return '<circle class="g-pt ln-pt" data-x="' + z.p.x + '" data-s="' + j + '" data-f="' + q.frac[k].toFixed(3) + '" cx="' + z.x.toFixed(1) + '" cy="' + z.y.toFixed(1) + '" r="' + (k === q.pos.length - 1 ? 5 : 4) + '" style="fill:' + (hueco ? 'var(--panel)' : q.sr.color) + ';stroke:' + (hueco ? q.sr.color : 'var(--panel)') + '"/>';
    }).join('');
    s += '<circle class="ln-cometa" r="5" cx="' + q.pos[0].x.toFixed(1) + '" cy="' + q.pos[0].y.toFixed(1) + '" style="fill:' + q.sr.color + '" data-s="' + j + '"/>';
  });
  // Cifra final en píldora del color de la serie; si dos quedan muy cerca se separan en vertical
  var fin = P.map(function (q, j) { var u = q.pos[q.pos.length - 1]; return {j: j, x: u.x + 12, y: u.y, v: u.p.v, ini: q.pos.length > 1 ? q.pos[q.pos.length - 2].p.v : u.p.v, sr: q.sr}; });
  fin.sort(function (a, b) { return a.y - b.y; });
  for (var i = 1; i < fin.length; i++) if (fin[i].y - fin[i - 1].y < 22) fin[i].y = fin[i - 1].y + 22;
  fin.forEach(function (f) {
    var t = o.fmt(f.v), w = anchoTxt(t);
    s += '<g class="ln-et" data-s="' + f.j + '" transform="translate(' + f.x.toFixed(1) + ' ' + f.y.toFixed(1) + ')"><rect x="0" y="-10.5" width="' + w + '" height="21" rx="10.5" style="fill:' + f.sr.color + '"/>' +
      '<text x="' + (w / 2) + '" y="4.5" text-anchor="middle" style="fill:' + (f.sr.tinta || '#fff') + '" data-v="' + f.v + '" data-ini="' + f.ini + '">' + esc(t) + '</text></g>';
  });
  xs.forEach(function (x, i) {
    var x0 = i ? (X(i - 1) + X(i)) / 2 : L, x1 = i < xs.length - 1 ? (X(i) + X(i + 1)) / 2 : W - R;
    s += '<rect class="hit" data-x="' + x + '" data-cx="' + X(i).toFixed(1) + '" x="' + x0.toFixed(1) + '" y="' + T + '" width="' + (x1 - x0).toFixed(1) + '" height="' + (yB - T) + '" ' + tip(o.tip ? o.tip(x) : '') + '/>';
  });
  // Firma de los datos: si no cambió (solo el tamaño o el tema) se redibuja quieto
  var firma = JSON.stringify([S.map(function (sr) { return [sr.nombre, sr.pts.map(function (p) { return [p.x, p.v]; })]; }), marcas]);
  var nueva = el._lnFirma !== firma;
  el._lnFirma = firma;
  el.innerHTML = s + '</svg>';
  guia(el);
  if (nueva && activo()) animarLineas(el, o);
}
function animarLineas(el, o) {
  var svg = el.querySelector('svg'), D = 1500, PAUSA = 120;
  svg.classList.add('ln-espera');
  var ir = function () {
    if (!svg.isConnected) return;
    svg.classList.remove('ln-espera'); svg.classList.add('ln-anima');
    var ez = 'cubic-bezier(' + EASE_L.join(',') + ')';
    svg.querySelectorAll('.ln-fondo').forEach(function (g) { g.animate([{opacity: 0}, {opacity: 1}], {duration: 500, easing: 'ease-out', fill: 'backwards'}); });
    svg.querySelectorAll('.ln-area').forEach(function (a) {
      var del = +a.getAttribute('data-s') * PAUSA;
      a.animate([{clipPath: 'inset(0 100% 0 0)', opacity: 0}, {clipPath: 'inset(0 0% 0 0)', opacity: 1}], {duration: D, delay: del + 80, easing: ez, fill: 'backwards'});
    });
    svg.querySelectorAll('.ln-linea, .ln-brillo').forEach(function (l) {
      var del = +l.getAttribute('data-s') * PAUSA;
      l.style.strokeDasharray = '1 1';
      var an = l.animate([{strokeDashoffset: 1}, {strokeDashoffset: 0}], {duration: D, delay: del, easing: ez, fill: 'both'});
      an.onfinish = function () { l.style.strokeDasharray = ''; try { an.cancel(); } catch (e) { /* nada */ } };
    });
    svg.querySelectorAll('.ln-pt').forEach(function (p) {
      var del = +p.getAttribute('data-s') * PAUSA + D * cuandoLlega(+p.getAttribute('data-f'));
      p.style.transformBox = 'fill-box'; p.style.transformOrigin = 'center';
      p.animate([{opacity: 0, transform: 'scale(0)'}, {opacity: 1, transform: 'scale(1.7)', offset: .55}, {opacity: 1, transform: 'scale(1)'}], {duration: 520, delay: del - 60, easing: 'ease-out', fill: 'backwards'});
    });
    // Cometa: sigue la curva real con getPointAtLength, al mismo ritmo que el trazo
    svg.querySelectorAll('.ln-cometa').forEach(function (c) {
      var j = c.getAttribute('data-s'), l = svg.querySelector('.ln-linea[data-s="' + j + '"]'), del = +j * PAUSA;
      if (!l || !M) return;
      var largo = l.getTotalLength();
      c.style.opacity = '1';
      M.animate(0, 1, {duration: D / 1000, delay: del / 1000, ease: EASE_L, onUpdate: function (f) { var q = l.getPointAtLength(f * largo); c.setAttribute('cx', q.x); c.setAttribute('cy', q.y); },
        onComplete: function () { c.animate([{opacity: 1, transform: 'scale(1)'}, {opacity: 0, transform: 'scale(2.6)'}], {duration: 450, easing: 'ease-out', fill: 'forwards'}); }});
      c.style.transformBox = 'fill-box'; c.style.transformOrigin = 'center';
    });
    svg.querySelectorAll('.ln-et').forEach(function (g) {
      var del = +g.getAttribute('data-s') * PAUSA + D * .82, t = g.querySelector('text');
      g.querySelector('rect').animate([{opacity: 0, transform: 'translateX(-10px) scale(.6)'}, {opacity: 1, transform: 'none'}], {duration: 520, delay: del, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards'});
      t.animate([{opacity: 0}, {opacity: 1}], {duration: 300, delay: del + 120, fill: 'backwards'});
      var fin = +t.getAttribute('data-v'), ini = +t.getAttribute('data-ini'), txt = t.textContent;
      if (M && isFinite(fin) && isFinite(ini) && ini !== fin) {
        M.animate(ini, fin, {duration: .9, delay: (del + 120) / 1000, ease: [.22, 1, .36, 1], onUpdate: function (v) { t.textContent = o.fmt(v); }, onComplete: function () { t.textContent = txt; }});
      }
    });
    setTimeout(function () { if (svg.isConnected) svg.classList.add('ln-late'); }, D + 600);
  };
  if (M && M.inView) M.inView(el, function () { ir(); }, {amount: .3}); else ir();
}

// ------------------------------------------------------------------ animación
// data-an: barra (scaleX, data-o l|r|c) · ancho (width desde 0) · alto (height desde 0) · tallo (scaleY, data-o b|t)
//          arco (stroke-dasharray desde 0, data-da final) · traza (pathLength=1) · pop · aparece · celdas · cuenta · desliza (left, data-desde)
// data-i = orden dentro del panel (retraso escalonado)
var DUR = .75, EASE = [.22, 1, .36, 1], PASO = .05;
function inicial(el) {
  var t = el.getAttribute('data-an'), s = el.style;
  if (t === 'barra') { s.transformOrigin = {l: 'left', r: 'right', c: 'center'}[el.getAttribute('data-o') || 'l']; s.transform = 'scaleX(0)'; }
  else if (t === 'tallo') { s.transformOrigin = el.getAttribute('data-o') === 't' ? 'top' : 'bottom'; s.transform = 'scaleY(0)'; }
  else if (t === 'ancho') { el.setAttribute('data-fin', s.width); s.width = '0%'; }
  else if (t === 'alto') { el.setAttribute('data-fin', s.height); s.height = '0%'; }
  else if (t === 'arco') { s.strokeDasharray = '0 100'; }
  else if (t === 'traza') { if (el.hasAttribute('vector-effect')) s.clipPath = 'inset(0 100% 0 0)'; else { s.strokeDasharray = '1 1'; s.strokeDashoffset = '1'; } }
  else if (t === 'pop') { s.opacity = '0'; s.transform = 'scale(.2)'; if (el instanceof SVGElement) { s.transformBox = 'fill-box'; s.transformOrigin = 'center'; } }
  else if (t === 'aparece') { s.opacity = '0'; }
  else if (t === 'celdas') { el.querySelectorAll('i').forEach(function (c) { c.style.opacity = '0'; c.style.transform = 'scale(.3)'; }); }
  else if (t === 'desliza') { el.setAttribute('data-fin', s.left); s.left = el.getAttribute('data-desde') || '0%'; }
  else if (t === 'cuenta') { el.textContent = fmtCuenta(el, el.getAttribute('data-desde') != null ? +el.getAttribute('data-desde') : 0); }
}
function fmtCuenta(el, v) { return (el.getAttribute('data-signo') && v > 0.0001 ? '+' : '') + num(v, +el.getAttribute('data-d')); }
function correr(el, base) {
  var t = el.getAttribute('data-an'), i = +(el.getAttribute('data-i') || 0), del = base + i * PASO, op = {duration: DUR, delay: del, ease: EASE};
  if (t === 'barra') return M.animate(el, {transform: ['scaleX(0)', 'scaleX(1)']}, op);
  else if (t === 'tallo') return M.animate(el, {transform: ['scaleY(0)', 'scaleY(1)']}, op);
  else if (t === 'ancho') return M.animate(el, {width: ['0%', el.getAttribute('data-fin')]}, op);
  else if (t === 'alto') return M.animate(el, {height: ['0%', el.getAttribute('data-fin')]}, op);
  // Trazos SVG con la Web Animations API nativa: Motion escribe stroke-* como atributo y el estilo en línea lo taparía
  else if (t === 'arco') { var da = el.getAttribute('data-da'); el.style.strokeDasharray = da; el.animate([{strokeDasharray: '0 100'}, {strokeDasharray: da}], {duration: DUR * 1500, delay: del * 1000, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards'}); }
  // Con vector-effect (sparks estirados) pathLength no sirve: se descubre de izquierda a derecha con clip-path
  else if (t === 'traza' && el.hasAttribute('vector-effect')) { el.style.clipPath = ''; el.animate([{clipPath: 'inset(0 100% 0 0)'}, {clipPath: 'inset(0 0% 0 0)'}], {duration: DUR * 1600, delay: del * 1000, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'backwards'}); }
  else if (t === 'traza') { el.style.strokeDashoffset = '0'; el.animate([{strokeDashoffset: 1}, {strokeDashoffset: 0}], {duration: DUR * 1600, delay: del * 1000, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'backwards'}); }
  // En SVG, Motion escribe opacity/transform como atributos y el estilo de arranque los taparía: WAAPI nativa
  else if ((t === 'pop' || t === 'aparece') && el instanceof SVGElement) {
    el.style.opacity = ''; el.style.transform = '';
    var fin = getComputedStyle(el).opacity;
    if (t === 'pop') el.animate([{opacity: 0, transform: 'scale(.2)'}, {opacity: fin, transform: 'scale(1.3)', offset: .65}, {opacity: fin, transform: 'scale(1)'}], {duration: 650, delay: (del + .25) * 1000, easing: 'ease-out', fill: 'backwards'});
    else el.animate([{opacity: 0}, {opacity: fin}], {duration: DUR * 1000, delay: (del + .2) * 1000, easing: 'ease-out', fill: 'backwards'});
  }
  else if (t === 'pop') return M.animate(el, {opacity: [0, 1], scale: [.2, 1]}, {duration: .55, delay: del + .25, type: 'spring', bounce: .45});
  else if (t === 'aparece') return M.animate(el, {opacity: [0, 1]}, {duration: DUR, delay: del + .2});
  else if (t === 'celdas') return M.animate(el.querySelectorAll('i'), {opacity: [0, 1], transform: ['scale(.3)', 'scale(1)']}, {duration: .35, delay: M.stagger(.006, {startDelay: del}), ease: [.34, 1.56, .64, 1]});
  else if (t === 'desliza') return M.animate(el, {left: [el.getAttribute('data-desde') || '0%', el.getAttribute('data-fin')]}, {duration: DUR * 1.2, delay: del, ease: EASE});
  else if (t === 'cuenta') {
    var fin = +el.getAttribute('data-v'), ini = el.getAttribute('data-desde') != null ? +el.getAttribute('data-desde') : 0;
    return M.animate(ini, fin, {duration: DUR * 1.3, delay: del, ease: EASE, onUpdate: function (v) { el.textContent = fmtCuenta(el, v); }, onComplete: function () { el.textContent = fmtCuenta(el, fin); }});
  }
}
// Al terminar se limpian los estilos de arranque, para que el estado final sea exactamente el del HTML
function limpiar(el) {
  var t = el.getAttribute('data-an'), s = el.style;
  if (t === 'ancho') s.width = el.getAttribute('data-fin');
  else if (t === 'alto') s.height = el.getAttribute('data-fin');
  else if (t === 'desliza') s.left = el.getAttribute('data-fin');
  else if (t === 'traza') { s.strokeDasharray = ''; s.strokeDashoffset = ''; s.clipPath = ''; }
  else if (t === 'pop') { s.opacity = ''; s.transform = ''; }
  else if (t === 'aparece' && el instanceof SVGElement) s.opacity = '';
}
// Lleva al estado final, sin animar, un elemento que aún esperaba entrar en pantalla (p. ej. al imprimir)
function terminar(el) {
  var t = el.getAttribute('data-an'), s = el.style;
  if (el.getAnimations) el.getAnimations().forEach(function (a) { try { a.finish(); } catch (e) { a.cancel(); } });
  limpiar(el);
  if (t === 'barra' || t === 'tallo' || t === 'pop') { s.transform = ''; s.opacity = ''; }
  else if (t === 'arco') s.strokeDasharray = el.getAttribute('data-da');
  else if (t === 'aparece') s.opacity = '';
  else if (t === 'celdas') el.querySelectorAll('i').forEach(function (c) { c.style.opacity = ''; c.style.transform = ''; });
  else if (t === 'cuenta') el.textContent = fmtCuenta(el, +el.getAttribute('data-v'));
}
var pendientes = [], vivos = [];
function terminarTodo() {
  pendientes.forEach(function (p) { p.lista.forEach(terminar); if (p.parar) p.parar(); });
  vivos.forEach(function (v) { v.ctrls.forEach(function (c) { try { c.complete(); } catch (e) { /* ya terminó */ } }); v.lista.forEach(terminar); });
  pendientes = []; vivos = [];
  [].forEach.call(document.querySelectorAll('svg.ln-espera'), function (g) { g.classList.remove('ln-espera'); g.classList.add('ln-late'); });
}
window.addEventListener('beforeprint', terminarTodo);
var activo = function () { return !!M && !reducir && !document.documentElement.hasAttribute('data-sin-anim'); };
// o.base = retraso inicial (s); o.inmediato = no esperar a que entre en pantalla
function animar(raiz, o) {
  o = o || {};
  if (!raiz || !activo()) return;
  var els = [].slice.call(raiz.querySelectorAll('[data-an]'));
  if (raiz.hasAttribute && raiz.hasAttribute('data-an')) els.unshift(raiz);
  if (!els.length) return;
  // Agrupar por contenedor (panel, tarjeta KPI…) para que cada uno se anime al entrar en pantalla
  var grupos = new Map();
  els.forEach(function (el) {
    if (el.closest('[data-an-hecho]')) return;
    inicial(el);
    var c = el.closest('.kpi, .panel, .paso, .etapa, section, figure') || raiz;
    if (!grupos.has(c)) grupos.set(c, []);
    grupos.get(c).push(el);
  });
  pendientes = pendientes.filter(function (p) { return document.contains(p.c); });
  grupos.forEach(function (lista, c) {
    var reg = {c: c, lista: lista, parar: null};
    var go = function () {
      var k = pendientes.indexOf(reg); if (k < 0) return; pendientes.splice(k, 1);
      if (reg.parar) reg.parar();
      var vivo = {lista: lista, ctrls: []};
      vivos.push(vivo);
      lista.forEach(function (el) { try { var c = correr(el, o.base || 0); if (c && c.complete) vivo.ctrls.push(c); } catch (e) { terminar(el); } });
      setTimeout(function () { lista.forEach(limpiar); var k = vivos.indexOf(vivo); if (k >= 0) vivos.splice(k, 1); }, (DUR * 1.6 + (o.base || 0) + PASO * 40 + .5) * 1000);
    };
    pendientes.push(reg);
    if (o.inmediato || !M.inView) go();
    else reg.parar = M.inView(c, function () { go(); }, {amount: .12});
  });
}

window.GRAF = {
  activo: activo, animar: animar, guia: guia, terminarTodo: terminarTodo,
  tono: tono, tonoV: tonoV, tonoDif: tonoDif, tinta: tinta, tonosEscala: tonosEscala, gradY: gradY, gradArea: gradArea, rampaCss: rampaCss,
  cuenta: cuenta, anillo: anillo, spark: spark, leyenda: leyenda, lineas: lineas, curva: curva,
  divergente: divergente, waffle: waffle, donas: donas, torres: torres, paletas: paletas, radial: radial, brecha: brecha, relojes: relojes,
  num: num, config: function (c) { if (c && c.tip) tipFn = c.tip; },
};
})();
