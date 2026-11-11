"""Orquesta el ETL: Oracle → limpieza → contrato de calidad → cubo + verbatims → data/periodos/AAAAMM.json
→ tablero/datos.js (todos los periodos guardados, codificados por diccionario).

Idempotente por periodo: cada corrida reemplaza solo los meses que encuentra en Oracle y conserva los
demás (la tabla fuente se recarga por corte y no guarda la historia). Si algún chequeo de nivel «error»
falla, no se escribe nada.

Uso:
    .venv/bin/python -m etl.construir                   # todos los periodos que haya en Oracle
    .venv/bin/python -m etl.construir --periodo 202610  # uno solo
    .venv/bin/python -m etl.construir --solo-ensamblar  # rehace datos.js con lo ya guardado (sin Oracle)
"""
import argparse
import json
import sys
from collections import Counter
from datetime import datetime

from etl import agregar, base, calidad, extraer, verbatims
from etl.config import (ABIERTAS, DIR_PERIODOS, EMOCIONES, ESTUDIOS, N_MINIMO, Q6_ESCALA, Q9_ATRIBUTOS, REGIONES,
                        SALIDA_JS, SIN_DATO, TABLA)
from etl.limpiar import limpiar


def _ahora():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def procesar(periodos_pedidos=None):
    conn = extraer.conectar()
    calidad.esquema(extraer.columnas_tabla(conn))
    crudo = extraer.encuestas(conn)
    repetidas = extraer.cuentas_repetidas(conn)
    conn.close()

    d = limpiar(crudo)
    if d.periodo.isna().any():
        raise calidad.ErrorCalidad(f"{int(d.periodo.isna().sum())} encuestas sin RECORDEDDATE")
    carga = crudo.FECHA_CARGA.max()

    periodos = sorted(d.periodo.unique())
    if periodos_pedidos:
        faltan = set(periodos_pedidos) - set(periodos)
        if faltan:
            raise SystemExit(f"Oracle no tiene los periodos {sorted(faltan)}; tiene {periodos}")
        periodos = sorted(periodos_pedidos)

    DIR_PERIODOS.mkdir(parents=True, exist_ok=True)
    salidas, errores = {}, []
    for p in periodos:
        sel = d.periodo == p
        sub, crudo_p = d[sel], crudo[sel]
        prev = DIR_PERIODOS / f"{int(p[:4]) - (p[4:] == '01')}{(int(p[4:]) - 2) % 12 + 1:02d}.json"
        n_ant = json.loads(prev.read_text())["n"] if prev.exists() else None
        chk = calidad.evaluar(crudo_p, sub, repetidas[repetidas.PERIODO == p], n_ant)

        actual = DIR_PERIODOS / f"{p}.json"
        if actual.exists():
            n_viejo = json.loads(actual.read_text())["n"]
            if n_viejo != len(sub):
                chk.append(calidad._chk("reemplazo", "aviso", "El corte reemplaza uno ya guardado",
                                        f"Antes {calidad.num(n_viejo)} encuestas, ahora {calidad.num(len(sub))}", len(sub)))

        vb, escaneo = verbatims.construir(crudo_p, sub)
        bf, esc_base = base.construir(crudo_p, sub)
        hall = calidad.escanear_pii(escaneo + esc_base)
        chk.append(calidad._chk("pii", "error" if hall else "ok", "Sin datos personales en los comentarios",
                                f"{len(hall)} hallazgos: {hall[:3]}" if hall else
                                f"{calidad.num(len(vb))} comentarios revisados: sin correos, cifras largas ni nombres",
                                len(hall)))
        al = sub.attrs.get("alineacion_analitica") or d.attrs.get("alineacion_analitica", {})
        chk.append(calidad._chk("analitica", "aviso" if al.get("Q4") == "Q7" else "ok",
                                "Temas de Qualtrics asignados a su pregunta",
                                "Las columnas Q4_* traen los temas de Q7 (qué fue difícil) y las Q7_* los de Q10 "
                                "(mejorar al asesor). El ETL los reasigna solo." if al.get("Q4") == "Q7"
                                else f"Alineación detectada: {al}", 0))

        errores += [f"{p} · {c['titulo']}: {c['detalle']}" for c in chk if c["nivel"] == "error"]
        salidas[p] = {
            "periodo": p, "n": int(len(sub)), "generado": _ahora(),
            "fecha_carga": str(carga)[:16], "tabla": TABLA,
            "filas": agregar.cubo(sub), "verbatims": vb, "base": bf, "calidad": chk,
        }

    if errores:
        print("CORRIDA DETENIDA: el contrato de calidad falló. No se escribió nada.", file=sys.stderr)
        for e in errores:
            print("  ✗", e, file=sys.stderr)
        raise SystemExit(1)

    for p, s in salidas.items():
        (DIR_PERIODOS / f"{p}.json").write_text(json.dumps(s, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        avisos = [c["titulo"] for c in s["calidad"] if c["nivel"] == "aviso"]
        print(f"{p}: {s['n']} encuestas, {len(s['verbatims'])} comentarios, {len(avisos)} avisos")
    return list(salidas)


# --------------------------------------------------------------------------- ensamblado
def _orden(valores, peso, fijo=None):
    vals = [v for v in valores if v != SIN_DATO]
    if fijo:
        vals = [v for v in fijo if v in vals] + sorted(v for v in vals if v not in fijo)
    else:
        vals = sorted(vals, key=lambda v: (-peso[v], v))
    return vals + ([SIN_DATO] if SIN_DATO in valores else [])


def ensamblar():
    archivos = sorted(DIR_PERIODOS.glob("*.json"))
    if not archivos:
        raise SystemExit("No hay periodos guardados en data/periodos/")
    per = [json.loads(a.read_text(encoding="utf-8")) for a in archivos]
    dims = agregar.DIMS

    peso = {k: Counter() for k in dims}
    for s in per:
        for f in s["filas"]:
            for k in dims:
                peso[k][f["d"][k]] += f["m"][0]
    fijos = {"estudio": ESTUDIOS, "region": REGIONES, "red": ["HFC", "FTTH", "DTH"],
             "estrato": ["1", "2", "3", "4", "5", "6"]}
    dic = {}
    for k in dims:
        vals = list(peso[k])
        dic[k] = sorted(vals) if k in ("periodo", "semana") else _orden(vals, peso[k], fijos.get(k))
    idx = {k: {v: i for i, v in enumerate(dic[k])} for k in dims}
    temas = {"td": sorted({t for s in per for f in s["filas"] for t in f.get("td", {})}),
             "tm": sorted({t for s in per for f in s["filas"] for t in f.get("tm", {})})}
    tidx = {k: {t: i for i, t in enumerate(v)} for k, v in temas.items()}
    grupos, preguntas = ["Detractor", "Pasivo", "Promotor"], list(ABIERTAS)

    cubo, td, tm, vb = [], [], [], []
    for s in per:
        for f in s["filas"]:
            r = len(cubo)
            cubo.append([idx[k][f["d"][k]] for k in dims] + f["m"])
            for nombre, dest in (("td", td), ("tm", tm)):
                for t, c in f.get(nombre, {}).items():
                    dest.append([r, tidx[nombre][t], c])
        for v in s["verbatims"]:
            vb.append([idx[k][v[k]] for k in dims] + [grupos.index(v["grupo"]) if v["grupo"] in grupos else -1,
                                                     -1 if v["q8"] is None else v["q8"],
                                                     -1 if v["q6"] is None else v["q6"],
                                                     -1 if v["q2"] is None else v["q2"],
                                                     -1 if v["q9"] is None else v["q9"],
                                                     preguntas.index(v["pregunta"]), v["texto"]])

    datos = {
        "generado": _ahora(), "tabla": per[-1]["tabla"], "n_minimo": N_MINIMO,
        "dims": dims, "valores": dic, "medidas": agregar.MEDIDAS,
        "emociones": EMOCIONES, "q6": list(Q6_ESCALA), "q9": list(Q9_ATRIBUTOS.values()),
        "temas": {"dificil": temas["td"], "mejora": temas["tm"]},
        "grupos": grupos, "preguntas": [ABIERTAS[q] for q in preguntas], "cod_preguntas": preguntas,
        "base": {"columnas": base.COLUMNAS, "filtro": base.FILTRO, "periodos": [s["periodo"] for s in per if s.get("base")]},
        "cubo": cubo, "temas_dificil": td, "temas_mejora": tm, "n_comentarios": len(vb),
        "periodos": {s["periodo"]: {"n": s["n"], "fecha_carga": s["fecha_carga"], "generado": s["generado"],
                                    "calidad": s["calidad"]} for s in per},
    }
    js = "window.DATOS=" + json.dumps(datos, ensure_ascii=False, separators=(",", ":")) + ";\n"
    SALIDA_JS.write_text(js, encoding="utf-8")
    # Los comentarios pesan ~90 % del total: van aparte y el tablero los carga después de pintar
    vjs = ("window.COMENTARIOS={\"campos\":" + json.dumps(dims + ["grupo", "q8", "q6", "q2", "q9", "pregunta", "texto"])
           + ",\"filas\":" + json.dumps(vb, ensure_ascii=False, separators=(",", ":")) + "};\n")
    (SALIDA_JS.parent / "comentarios.js").write_text(vjs, encoding="utf-8")
    # Base descargable: un archivo por mes; el tablero carga solo los meses que se van a descargar
    dir_base = SALIDA_JS.parent / "base"
    dir_base.mkdir(exist_ok=True)
    for f in dir_base.glob("*.js"):
        f.unlink()
    for s in per:
        (dir_base / f"{s['periodo']}.js").write_text(
            f"(window.BASE=window.BASE||{{}})[\"{s['periodo']}\"]=" + json.dumps(s.get("base", []), ensure_ascii=False, separators=(",", ":")) + ";\n",
            encoding="utf-8")
    print(f"datos.js: {len(cubo)} filas de cubo, {len(js) / 1024:.0f} KB · comentarios.js: {len(vb)} comentarios, "
          f"{len(vjs) / 1024:.0f} KB → {SALIDA_JS.parent}")
    return datos


def resumen(datos):
    """Indicadores por periodo y estudio, para cuadrar contra la fuente en consola."""
    M = {m: i + len(datos["dims"]) for i, m in enumerate(datos["medidas"])}
    ie, ip = datos["dims"].index("estudio"), datos["dims"].index("periodo")
    acc = {}
    for r in datos["cubo"]:
        k = (datos["valores"]["periodo"][r[ip]], datos["valores"]["estudio"][r[ie]])
        a = acc.setdefault(k, Counter())
        for m, i in M.items():
            a[m] += r[i]
    for (p, e), a in sorted(acc.items()):
        ces = (a["q6_4"] + a["q6_5"]) / sum(a[f"q6_{i}"] for i in range(1, 6)) * 100
        print(f"  {p} {e:13s} n={a['n']:5d}  NPS={(a['prom'] - a['det']) / a['n'] * 100:6.1f}  "
              f"CES={ces:5.1f} %  Funciona={a['q8_si'] / (a['q8_si'] + a['q8_no']) * 100:5.1f} %")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--periodo", action="append", help="AAAAMM; se puede repetir")
    ap.add_argument("--solo-ensamblar", action="store_true")
    a = ap.parse_args()
    if not a.solo_ensamblar:
        try:
            procesar(a.periodo)
        except calidad.ErrorCalidad as e:
            print(f"CORRIDA DETENIDA: {e}", file=sys.stderr)
            raise SystemExit(1)
    resumen(ensamblar())


if __name__ == "__main__":
    main()
