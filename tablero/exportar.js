/* Copia de claro_CR_Recurrencia/tablero/Tablero de CR/exportar.js (mismo escritor de CSV, Excel y Parquet);
   aquí solo cambian los nombres de las columnas numéricas y de fecha (base de encuestas de Soporte y Fallas masivas).
   Formatos de la descarga: CSV, Excel (.xlsx) y Parquet.
   Cada escritor recibe por tandas las líneas del CSV del detalle (';', sin cabecera) y guarda solo lo ya
   comprimido, para que un mes completo (~1,8 millones de filas) quepa en el navegador. Sin librerías:
   el .xlsx es un zip de XML (deflate del navegador) y el Parquet guarda columnas PLAIN comprimidas con
   gzip y sus metadatos en Thrift compacto. Prueba: node pruebas/prueba_exportar.mjs */
(function (g) {
"use strict";
const enc = new TextEncoder();
const FILAS_EXCEL = 1048575;                 // filas de datos por hoja (más la cabecera)
const FILAS_GRUPO = 100000;                  // filas por grupo de Parquet

/* Campos de una línea. pandas solo pone comillas si el campo trae ';', comillas o un salto de línea. */
function campos(l) {
  if (!l.includes('"')) return l.split(";");
  const r = []; let c = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch !== '"') c += ch; else if (l[i + 1] === '"') { c += '"'; i++; } else q = false; }
    else if (ch === '"') q = true; else if (ch === ";") { r.push(c); c = ""; } else c += ch;
  }
  r.push(c);
  return r;
}
/* Tipo de cada columna: n entero, t fecha y hora ("AAAA-MM-DD HH:MM:SS"), s texto (cuentas y líneas siempre texto) */
const NUMERICAS = new Set(["Recomendación (0-10)", "Facilidad (1-5)", "Profesionalismo (1-5)", "Amabilidad (1-5)", "Claridad (1-5)", "Tiempo de atención (1-5)"]),
      FECHAS = new Set(["Fecha respuesta", "Fecha contacto"]);
const tipoCol = c => NUMERICAS.has(c) ? "n" : FECHAS.has(c) ? "t" : "s";
const entero = s => /^-?\d{1,9}$/.test(s) ? Number(s) : null;
const fechaMs = s => { const m = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d)(?::(\d\d))?)?$/.exec(s); return m ? Date.UTC(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) : null; };
const u32 = n => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
const comprimir = async (formato, partes) => new Uint8Array(await new Response(new Blob(partes).stream().pipeThrough(new CompressionStream(formato))).arrayBuffer());

/* ---------- CSV (';' y BOM: Excel en español lo abre en columnas) ---------- */
function csv(cols) {
  const partes = [enc.encode("﻿" + cols.join(";") + "\n")];
  return {
    async agregar(lineas) { if (lineas.length) partes.push(enc.encode(lineas.join("\n") + "\n")); },
    async cerrar() { return new Blob(partes, {type: "text/csv;charset=utf-8"}); },
  };
}

/* ---------- Excel: zip con un libro de una o varias hojas ---------- */
const CRC = Int32Array.from({length: 256}, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n; });
const crc32 = (c, b) => { c = ~c; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };

/* Una entrada del zip comprimida a medida que se escribe */
function entrada(nombre) {
  const cs = new CompressionStream("deflate-raw"), w = cs.writable.getWriter(), salida = new Response(cs.readable).blob();
  let crc = 0, n = 0;
  return {
    async escribir(txt) { const b = enc.encode(txt); crc = crc32(crc, b); n += b.length; await w.write(b); },
    async fin() { await w.close(); const datos = await salida; return {nombre, datos, crc, n}; },
  };
}
function zip(entradas) {                     // entradas: [{nombre, datos (deflate), crc, n}] → Blob
  const partes = [], central = [];
  let pos = 0;
  for (const e of entradas) {
    if (e.n > 0xFFFFFFFF || pos > 0xFFFFFFFF) throw new Error("zip64");
    const nom = enc.encode(e.nombre), cab = (sig, extra) => {
      const b = new Uint8Array(extra + nom.length), v = new DataView(b.buffer);
      v.setUint32(0, sig, true); return [b, v];
    };
    const [loc, l] = cab(0x04034b50, 30);
    l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true); l.setUint16(8, 8, true); l.setUint16(12, 0x21, true);
    l.setUint32(14, e.crc, true); l.setUint32(18, e.datos.size, true); l.setUint32(22, e.n, true); l.setUint16(26, nom.length, true);
    loc.set(nom, 30);
    const [cen, c] = cab(0x02014b50, 46);
    c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 8, true); c.setUint16(14, 0x21, true);
    c.setUint32(16, e.crc, true); c.setUint32(20, e.datos.size, true); c.setUint32(24, e.n, true); c.setUint16(28, nom.length, true);
    c.setUint32(42, pos, true); cen.set(nom, 46);
    partes.push(loc, e.datos); central.push(cen);
    pos += loc.length + e.datos.size;
  }
  const tam = central.reduce((t, b) => t + b.length, 0), fin = new Uint8Array(22), v = new DataView(fin.buffer);
  v.setUint32(0, 0x06054b50, true); v.setUint16(8, entradas.length, true); v.setUint16(10, entradas.length, true);
  v.setUint32(12, tam, true); v.setUint32(16, pos, true);
  return new Blob([...partes, ...central, fin], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
const xesc = s => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").replace(/[&<>]/g, c => c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;");
const letra = i => (i >= 26 ? letra(Math.floor(i / 26) - 1) : "") + String.fromCharCode(65 + i % 26);
const EPOCA = Date.UTC(1899, 11, 30);
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
async function fija(nombre, txt) { const e = entrada(nombre); await e.escribir(txt); return e.fin(); }

function xlsx(cols) {
  const tipos = cols.map(tipoCol), letras = cols.map((_, i) => letra(i)), hojas = [];
  let hoja = null, fila = 0;
  const celda = (v, j, r) => {
    if (v === "") return "";
    const ref = letras[j] + r;
    if (tipos[j] === "n") { const x = entero(v); if (x != null) return `<c r="${ref}"><v>${x}</v></c>`; }
    if (tipos[j] === "t") { const x = fechaMs(v); if (x != null) return `<c r="${ref}" s="1"><v>${(x - EPOCA) / 864e5}</v></c>`; }
    return `<c r="${ref}" t="inlineStr"><is><t${/^\s|\s$/.test(v) ? ' xml:space="preserve"' : ""}>${xesc(v)}</t></is></c>`;
  };
  async function abrir() {
    hoja = entrada(`xl/worksheets/sheet${hojas.length + 1}.xml`); fila = 1;
    await hoja.escribir(`${XML}<worksheet ${NS}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>`
      + `<row r="1">${cols.map((c, j) => `<c r="${letras[j]}1" t="inlineStr" s="2"><is><t>${xesc(c)}</t></is></c>`).join("")}</row>`);
  }
  async function cerrarHoja() { await hoja.escribir("</sheetData></worksheet>"); hojas.push(await hoja.fin()); }
  return {
    async agregar(lineas) {
      let xml = "";
      for (const l of lineas) {
        if (!hoja || fila > FILAS_EXCEL) {
          if (xml) { await hoja.escribir(xml); xml = ""; }
          if (hoja) await cerrarHoja();
          await abrir();
        }
        fila++;
        const fs = campos(l);
        let x = `<row r="${fila}">`;
        for (let j = 0; j < cols.length; j++) x += celda(fs[j] ?? "", j, fila);
        xml += x + "</row>";
      }
      if (xml) await hoja.escribir(xml);
    },
    /* extras (opcional): hojas pequeñas que van después del detalle, [{nombre, cols: [[título, tipo]], filas: [[valor]]}];
       tipo "s" texto, "n" número, "p" porcentaje (fracción con formato 0,00 %). */
    async cerrar(extras = []) {
      if (!hoja) await abrir();
      await cerrarHoja();
      const nombres = hojas.map((_, i) => i ? `Detalle ${i + 1}` : "Detalle");
      for (const x of extras) {
        const e = entrada(`xl/worksheets/sheet${hojas.length + 1}.xml`), ls = x.cols.map((_, j) => letra(j));
        const c = (v, j, r) => v == null || v === "" ? "" : typeof v === "number" && isFinite(v)
          ? `<c r="${ls[j]}${r}"${x.cols[j][1] === "p" ? ' s="3"' : ""}><v>${v}</v></c>` : `<c r="${ls[j]}${r}" t="inlineStr"><is><t>${xesc(String(v))}</t></is></c>`;
        await e.escribir(`${XML}<worksheet ${NS}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>`
          + `<row r="1">${x.cols.map(([t], j) => `<c r="${ls[j]}1" t="inlineStr" s="2"><is><t>${xesc(t)}</t></is></c>`).join("")}</row>`
          + x.filas.map((f, i) => `<row r="${i + 2}">${f.map((v, j) => c(v, j, i + 2)).join("")}</row>`).join("") + "</sheetData></worksheet>");
        hojas.push(await e.fin()); nombres.push(x.nombre.slice(0, 31));
      }
      const n = hojas.length, nombre = i => xesc(nombres[i]);
      return zip([
        await fija("[Content_Types].xml", `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>`
          + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
          + hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") + "</Types>"),
        await fija("_rels/.rels", `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
        await fija("xl/workbook.xml", `${XML}<workbook ${NS} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>`
          + hojas.map((_, i) => `<sheet name="${nombre(i)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") + "</sheets></workbook>"),
        await fija("xl/_rels/workbook.xml.rels", `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
          + hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")
          + `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
        await fija("xl/styles.xml", `${XML}<styleSheet ${NS}><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts>`
          + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
          + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
          + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
          + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>'
          + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'),
        ...hojas,
      ]);
    },
  };
}

/* ---------- Parquet: columnas opcionales (vacío = nulo), una página por columna y grupo ---------- */
const T = {bool: 1, i32: 5, i64: 6, str: 8, list: 9, struct: 12};
function thrift(campos) {                    // struct en Thrift compacto: [[id, tipo, valor]] en orden de id
  const out = [];
  const varint = n => { while (n >= 128) { out.push(n % 128 + 128); n = Math.floor(n / 128); } out.push(n); };
  const zz = n => n >= 0 ? 2 * n : -2 * n - 1;
  const valor = (t, v) => {
    if (t === "i32" || t === "i64") varint(zz(v));
    else if (t === "str") { const b = enc.encode(v); varint(b.length); for (const x of b) out.push(x); }
    else if (t === "struct") struct(v);
    else { const [te, vs] = v; vs.length < 15 ? out.push(vs.length << 4 | T[te]) : (out.push(0xF0 | T[te]), varint(vs.length)); for (const x of vs) valor(te, x); }
  };
  function struct(cs) {
    let previo = 0;
    for (const [id, t, v] of cs) {
      const tt = t === "bool" ? (v ? 1 : 2) : T[t];
      if (id > previo && id - previo <= 15) out.push((id - previo) << 4 | tt); else { out.push(tt); varint(zz(id)); }
      previo = id;
      if (t !== "bool") valor(t, v);
    }
    out.push(0);
  }
  struct(campos);
  return Uint8Array.from(out);
}
function rle(d, n) {                         // niveles de definición (0 nulo, 1 dato) en corridas RLE
  const out = [];
  for (let i = 0; i < n;) {
    let j = i; while (j < n && d[j] === d[i]) j++;
    for (let k = (j - i) * 2; ; k = Math.floor(k / 128)) { if (k < 128) { out.push(k); break; } out.push(k % 128 + 128); }
    out.push(d[i]); i = j;
  }
  return Uint8Array.from(out);
}
class Bytes {                                // búfer que crece
  constructor() { this.b = new Uint8Array(1 << 16); this.n = 0; this.v = new DataView(this.b.buffer); }
  espacio(k) { if (this.n + k <= this.b.length) return; const b = new Uint8Array(Math.max(this.b.length * 2, this.n + k)); b.set(this.b.subarray(0, this.n)); this.b = b; this.v = new DataView(b.buffer); }
  texto(s) { this.espacio(4 + s.length * 3); const {written} = enc.encodeInto(s, this.b.subarray(this.n + 4)); this.v.setUint32(this.n, written, true); this.n += 4 + written; }
  i32(x) { this.espacio(4); this.v.setInt32(this.n, x, true); this.n += 4; }
  i64(x) { this.espacio(8); this.v.setUint32(this.n, x % 4294967296, true); this.v.setUint32(this.n + 4, Math.floor(x / 4294967296), true); this.n += 8; }
}
const FISICO = {s: 6, n: 1, t: 2};           // BYTE_ARRAY, INT32, INT64

function parquet(cols) {
  const tipos = cols.map(tipoCol), partes = [enc.encode("PAR1")], grupos = [];
  let pos = 4, filas = 0, total = 0, def, vals;
  const nuevo = () => { def = cols.map(() => new Uint8Array(FILAS_GRUPO)); vals = cols.map(() => new Bytes()); filas = 0; };
  nuevo();
  async function volcar() {
    if (!filas) return;
    const cc = [];
    let bytes = 0;
    for (let j = 0; j < cols.length; j++) {
      const d = rle(def[j], filas), datos = [u32(d.length), d, vals[j].b.subarray(0, vals[j].n)];
      const crudo = datos.reduce((t, b) => t + b.length, 0), comp = await comprimir("gzip", datos);
      const cab = thrift([[1, "i32", 0], [2, "i32", crudo], [3, "i32", comp.length], [5, "struct", [[1, "i32", filas], [2, "i32", 0], [3, "i32", 3], [4, "i32", 3]]]]);
      cc.push([[2, "i64", pos], [3, "struct", [[1, "i32", FISICO[tipos[j]]], [2, "list", ["i32", [0, 3]]], [3, "list", ["str", [cols[j]]]], [4, "i32", 2],
        [5, "i64", filas], [6, "i64", cab.length + crudo], [7, "i64", cab.length + comp.length], [9, "i64", pos]]]]);
      partes.push(cab, comp); pos += cab.length + comp.length; bytes += cab.length + crudo;
    }
    grupos.push([[1, "list", ["struct", cc]], [2, "i64", bytes], [3, "i64", filas]]);
    total += filas; nuevo();
  }
  return {
    async agregar(lineas) {
      for (const l of lineas) {
        const fs = campos(l);
        for (let j = 0; j < cols.length; j++) {
          const v = fs[j] ?? "", t = tipos[j], x = t === "n" ? entero(v) : t === "t" ? fechaMs(v) : v === "" ? null : v;
          if (x == null) continue;
          def[j][filas] = 1;
          if (t === "s") vals[j].texto(x); else if (t === "n") vals[j].i32(x); else vals[j].i64(x);
        }
        if (++filas === FILAS_GRUPO) await volcar();
      }
    },
    async cerrar() {
      await volcar();
      const esquema = [[[4, "str", "base"], [5, "i32", cols.length]], ...cols.map((c, j) => {
        const e = [[1, "i32", FISICO[tipos[j]]], [3, "i32", 1], [4, "str", c]];
        if (tipos[j] === "s") e.push([6, "i32", 0], [10, "struct", [[1, "struct", []]]]);                                   // UTF8 / STRING
        if (tipos[j] === "t") e.push([10, "struct", [[8, "struct", [[1, "bool", false], [2, "struct", [[1, "struct", []]]]]]]]);   // TIMESTAMP(ms, hora local)
        return e;
      })];
      const meta = thrift([[1, "i32", 1], [2, "list", ["struct", esquema]], [3, "i64", total], [4, "list", ["struct", grupos]], [6, "str", "Tablero Soporte y Fallas masivas"]]);
      partes.push(meta, u32(meta.length), enc.encode("PAR1"));
      return new Blob(partes, {type: "application/vnd.apache.parquet"});
    },
  };
}

g.EXPORTAR = {FILAS_EXCEL, campos, crear: (formato, cols) => ({csv, xlsx, parquet})[formato](cols)};
})(typeof window !== "undefined" ? window : globalThis);
