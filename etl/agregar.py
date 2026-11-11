"""Cubo de CONTEOS sumables. El navegador suma filas según los filtros y recién ahí calcula cada
indicador, así cualquier combinación de filtros da el valor ponderado correcto (nunca un promedio de %).
"""
import pandas as pd

from etl.config import EMOCIONES, Q9_ATRIBUTOS

DIMS = ["periodo", "semana", "estudio", "region", "red", "marcacion", "aliado", "operacion", "estrato"]

# Orden fijo de las medidas: el tablero las lee por nombre desde `medidas` en datos.js
MEDIDAS = (
    ["n", "prom", "det",
     "q6_1", "q6_2", "q6_3", "q6_4", "q6_5",
     "q8_si", "q8_no", "prom_si", "det_si", "prom_no", "det_no"]
    + [f"{q.lower()}_{s}" for q in Q9_ATRIBUTOS for s in ("top2", "val")]
    + [f"emo_{i}" for i in range(len(EMOCIONES))]
    + ["com_q7", "com_q10"]  # encuestas con comentario: base de los % de temas
)


def _indicadoras(d):
    m = pd.DataFrame(index=d.index)
    m["n"] = 1
    m["prom"] = (d.q2 >= 9).astype(int)
    m["det"] = (d.q2 <= 6).astype(int)
    for k in range(1, 6):
        m[f"q6_{k}"] = (d.q6 == k).astype(int)
    m["q8_si"] = (d.q8 == 1).astype(int)
    m["q8_no"] = (d.q8 == 0).astype(int)
    m["prom_si"] = m.prom * m.q8_si
    m["det_si"] = m.det * m.q8_si
    m["prom_no"] = m.prom * m.q8_no
    m["det_no"] = m.det * m.q8_no
    for q in Q9_ATRIBUTOS:
        c = d[q.lower()]
        m[f"{q.lower()}_top2"] = (c >= 4).astype(int)
        m[f"{q.lower()}_val"] = c.notna().astype(int)
    for i, e in enumerate(EMOCIONES):
        m[f"emo_{i}"] = (d.emocion == e).astype(int)
    m["com_q7"], m["com_q10"] = d.com_q7, d.com_q10
    return m[MEDIDAS]


# Por dolor: encuestas, promotores, detractores, CES fácil y CES válidas (las de «sin dolor» salen por resta)
MEDIDAS_DOLOR = ["n", "prom", "det", "ces_ok", "ces_val"]


def _dolores(d, dl):
    """Serie (DIMS + dolor) → [conteos de MEDIDAS_DOLOR]; solo combinaciones con al menos una encuesta."""
    base = pd.DataFrame({"n": 1, "prom": (d.q2 >= 9).astype(int), "det": (d.q2 <= 6).astype(int),
                         "ces_ok": (d.q6 >= 4).astype(int), "ces_val": d.q6.notna().astype(int)}, index=d.index)
    partes = []
    for k in dl.columns:
        sel = dl[k]
        if sel.any():
            partes.append(pd.concat([d.loc[sel, DIMS], base[sel]], axis=1).assign(dolor=k))
    if not partes:
        return {}
    g = pd.concat(partes).groupby(DIMS + ["dolor"], dropna=False, sort=False)[MEDIDAS_DOLOR].sum()
    out = {}
    for clave, fila in g.iterrows():
        out.setdefault(clave[:-1], {})[clave[-1]] = [int(v) for v in fila]
    return out


def cubo(d, dl=None):
    """Filas = combinaciones de DIMS presentes; medidas = conteos. Temas (multi-etiqueta) y dolores en dicts aparte."""
    m = pd.concat([d[DIMS], _indicadoras(d)], axis=1)
    g = m.groupby(DIMS, dropna=False, sort=True)[MEDIDAS].sum().reset_index()

    def _temas(col):
        ex = d[DIMS + [col]].explode(col).dropna(subset=[col])
        return ex.groupby(DIMS + [col]).size()

    td, tm = _temas("temas_dificil"), _temas("temas_mejora")
    dol = _dolores(d, dl) if dl is not None else {}
    filas = []
    for r in g.itertuples(index=False):
        clave = tuple(getattr(r, k) for k in DIMS)
        fila = {"d": dict(zip(DIMS, clave)), "m": [int(getattr(r, k)) for k in MEDIDAS]}
        for nombre, serie in (("td", td), ("tm", tm)):
            try:
                sub = serie.loc[clave]
                fila[nombre] = {str(k): int(v) for k, v in sub.items()}
            except KeyError:
                pass
        if clave in dol:
            fila["dl"] = dol[clave]
        filas.append(fila)
    return filas
