"""Carga única (pedido del usuario 2026-11-11): exportes de Qualtrics ene–sep 2026 (Excel) → Oracle
INVITADO_15.TBL_ENC_SOPORTE_FALLAS, con el mismo formato que trae el corte de octubre.

- Solo INSERT, en una transacción. Salta las respuestas cuyo RESPONSEID ya esté en la tabla (re-ejecutable).
- Todas las filas del lote llevan el mismo FECHA_CARGA, así se identifican y se pueden revertir:
      DELETE FROM INVITADO_15.TBL_ENC_SOPORTE_FALLAS WHERE FECHA_CARGA = TO_DATE('<lote>', 'YYYY-MM-DD HH24:MI:SS')
- Normaliza lo que cambió entre exportes: Status/Finished en inglés (ago–sep) → español como octubre.
  Las columnas extra de algunos meses (Q_RecaptchaStatus, Topic Hierarchy 3–5…) no existen en la tabla y se omiten.

Uso:
    .venv/bin/python -m etl.cargar_historico            # simula: valida y cuenta, no escribe
    .venv/bin/python -m etl.cargar_historico --escribir # inserta y hace COMMIT
"""
import argparse
import json
import math
import re
from datetime import datetime

import oracledb
import pandas as pd

from etl import extraer
from etl.config import RAIZ, TABLA

ORIGEN = "/opt/apps/claro_analisis_umm/Suficiencia Soporte/Historico CES"
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre"]
TRADUCE = {"STATUS": {"IP Address": "Dirección IP"}, "FINISHED": {"True": "Verdadero", "False": "Falso"}}


def nombre_oracle(c):
    """'Duration (in seconds)' → 'DURATION_IN_SECONDS'; 'Q7 - Topic Hierarchy Level 1' → 'Q7_TOPIC_HIERARCHY_LEVEL_1'."""
    c = c.replace(" - ", "_").replace("(", "").replace(")", "")
    return re.sub(r"\s+", "_", c.strip()).upper()


def a_texto(col, v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    if isinstance(v, (pd.Timestamp, datetime)):
        fmt = {"FECHA": "%Y-%m-%dT%H:%M", "FEC_GENERACION": "%Y-%m-%d"}.get(col, "%Y-%m-%d %H:%M:%S")
        return v.strftime(fmt)
    if isinstance(v, bool):
        v = "True" if v else "False"
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = str(v)
    return TRADUCE.get(col, {}).get(s, s)


def recortar(s, maximo=4000):
    """VARCHAR2(4000) cuenta bytes: recorta en UTF-8 sin partir caracteres."""
    if s is None or len(s.encode("utf-8")) <= maximo:
        return s, False
    return s.encode("utf-8")[:maximo - 3].decode("utf-8", "ignore") + "…", True


def leer(cols_oracle):
    lotes, omitidas = [], set()
    for m in MESES:
        d = pd.read_excel(f"{ORIGEN}/{m}.xlsx", sheet_name=0, dtype=object).iloc[1:]  # fila 1 = textos de las preguntas
        d.columns = [nombre_oracle(c) for c in d.columns]
        omitidas |= set(d.columns) - set(cols_oracle)
        lotes.append(d.assign(_ARCHIVO=m))
    return pd.concat(lotes, ignore_index=True), sorted(omitidas)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--escribir", action="store_true")
    a = ap.parse_args()

    conn = extraer.conectar()
    cols = [c for c in extraer._df(conn, "SELECT column_name, column_id FROM all_tab_columns WHERE owner='INVITADO_15' "
                                         "AND table_name='TBL_ENC_SOPORTE_FALLAS' ORDER BY column_id").COLUMN_NAME]
    d, omitidas = leer(cols)
    faltan = [c for c in cols if c not in d.columns and c != "FECHA_CARGA"]
    if faltan:
        raise SystemExit(f"Columnas de la tabla que no vienen en los Excel: {faltan}")
    if d.RESPONSEID.duplicated().any():
        raise SystemExit("RESPONSEID repetido entre los Excel")

    existentes = set(extraer._df(conn, f"SELECT RESPONSEID FROM {TABLA}").RESPONSEID)
    nuevos = d[~d.RESPONSEID.isin(existentes)]
    lote = datetime.now().replace(microsecond=0)
    ins = [c for c in cols if c != "FECHA_CARGA"]
    filas, recortes = [], []
    for r in nuevos.itertuples(index=False):
        rr = r._asdict()
        fila = []
        for c in ins:
            v, cortado = recortar(a_texto(c, rr[c]))
            if cortado:
                recortes.append((rr["RESPONSEID"], c))
            fila.append(v)
        fila[ins.index("RECORDEDDATE")] = pd.Timestamp(rr["RECORDEDDATE"]).to_pydatetime().replace(microsecond=0)
        filas.append(fila + [lote])

    por_mes = nuevos.groupby("_ARCHIVO", sort=False).size().to_dict()
    print(f"Excel: {len(d)} respuestas · ya en Oracle: {len(d) - len(nuevos)} · por insertar: {len(filas)}")
    print("Por archivo:", por_mes)
    print("Columnas omitidas (no existen en la tabla):", omitidas)
    print(f"Textos recortados a 4000 bytes: {len(recortes)} {recortes}")
    if not a.escribir:
        print("Simulación: no se escribió nada. Agrega --escribir para cargar.")
        return

    antes = int(extraer._df(conn, f"SELECT COUNT(*) N FROM {TABLA}").N[0])
    sql = f"INSERT INTO {TABLA} ({', '.join(ins + ['FECHA_CARGA'])}) VALUES ({', '.join(':' + str(i + 1) for i in range(len(ins) + 1))})"
    with conn.cursor() as cur:
        cur.setinputsizes(*[oracledb.DB_TYPE_DATE if c == "RECORDEDDATE" else 4000 for c in ins], oracledb.DB_TYPE_DATE)
        for i in range(0, len(filas), 1000):
            cur.executemany(sql, filas[i:i + 1000])
    despues = int(extraer._df(conn, f"SELECT COUNT(*) N FROM {TABLA}").N[0])
    if despues - antes != len(filas):
        conn.rollback()
        raise SystemExit(f"Conteo inesperado ({antes} → {despues}); ROLLBACK")
    conn.commit()
    reg = RAIZ / "data" / "cargas" / f"historico_{lote:%Y%m%d_%H%M%S}.json"
    reg.parent.mkdir(parents=True, exist_ok=True)
    reg.write_text(json.dumps({"lote_fecha_carga": str(lote), "filas": len(filas), "por_archivo": por_mes,
                               "origen": ORIGEN, "tabla": TABLA, "antes": antes, "despues": despues, "recortados": recortes,
                               "revertir": f"DELETE FROM {TABLA} WHERE FECHA_CARGA = TO_DATE('{lote}', 'YYYY-MM-DD HH24:MI:SS')"},
                              ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"COMMIT: {antes} → {despues} filas. Lote FECHA_CARGA = {lote}. Registro: {reg}")


if __name__ == "__main__":
    main()
