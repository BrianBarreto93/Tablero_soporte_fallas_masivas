/* graficos.js · gráficos animados compartidos (tableros Factura, pago y cobro / Soporte y Fallas masivas).
   El MISMO archivo va en los dos tableros: si se cambia uno, copiarlo al otro.

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

// Spark de área: series = [{color, pts:[{i, v}]}], n = total de posiciones, marcas = posiciones resaltadas
var nId = 0;
function spark(series, n, marcas, o) {
  o = o || {};
  var W = 200, H = o.alto || 40, all = [];
  series.forEach(function (s) { s.pts.forEach(function (p) { all.push(p.v); }); });
  if (!all.length) return '';
  var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), rg = hi - lo || 1;
  var X = function (i) { return 3 + (W - 6) * i / Math.max(1, n - 1); }, Y = function (v) { return 4 + (H - 8) * (1 - (v - lo) / rg); };
  var s = '<svg class="spark g-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><defs>';
  var ids = series.map(function (sr) { var id = 'gsa' + (++nId); s += gradArea(id, sr.color); return id; });
  s += '</defs>';
  (marcas || []).forEach(function (m) { s += '<line x1="' + X(m) + '" x2="' + X(m) + '" y1="0" y2="' + H + '" class="g-marca" vector-effect="non-scaling-stroke"/>'; });
  series.forEach(function (sr, k) {
    if (sr.pts.length < 2) return;
    var d = sr.pts.map(function (p, j) { return (j ? 'L' : 'M') + X(p.i).toFixed(1) + ' ' + Y(p.v).toFixed(1); }).join(' ');
    var a = d + ' L' + X(sr.pts[sr.pts.length - 1].i).toFixed(1) + ' ' + H + ' L' + X(sr.pts[0].i).toFixed(1) + ' ' + H + ' Z';
    s += '<path d="' + a + '" style="fill:url(#' + ids[k] + ')" data-an="aparece" data-i="' + (k + 2) + '"/>';
    s += '<path d="' + d + '" pathLength="1" style="fill:none;stroke:' + sr.color + ';stroke-width:2;stroke-linejoin:round;stroke-linecap:round" vector-effect="non-scaling-stroke" data-an="traza" data-i="' + k + '"/>';
  });
  return s + '</svg>';
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
  cuenta: cuenta, anillo: anillo, spark: spark, leyenda: leyenda,
  divergente: divergente, waffle: waffle, donas: donas, torres: torres, paletas: paletas, radial: radial, brecha: brecha, relojes: relojes,
  num: num, config: function (c) { if (c && c.tip) tipFn = c.tip; },
};
})();
