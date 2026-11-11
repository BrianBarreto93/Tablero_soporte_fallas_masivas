"""Lectura de Oracle (solo lectura). Conexión con el mismo patrón de CSAT Hogar/etl/construir_datos.py."""
import os

import oracledb
import pandas as pd

from etl.config import CLAVE_CUENTA, COLUMNAS, COLUMNAS_SOLO_LIMPIEZA, RAIZ, TABLA


def _load_env(path=RAIZ / ".env"):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip("'\""))


def _req(clave):
    val = os.environ.get(clave)
    if not val:
        raise RuntimeError(f"Falta {clave} en .env (ver .env.example)")
    return val


def conectar():
    _load_env()
    conn = oracledb.connect(
        user=_req("ORACLE_USER"), password=_req("ORACLE_PASSWORD"),
        host=_req("ORACLE_HOST"), port=int(_req("ORACLE_PORT")), service_name=_req("ORACLE_DBNAME"),
    )
    with conn.cursor() as cur:
        cur.execute("BEGIN DBMS_APPLICATION_INFO.SET_MODULE('claro_tablero_sop_fm', 'construir'); END;")
    return conn


def _df(conn, sql, params=None):
    with conn.cursor() as cur:
        cur.execute(sql, params or {})
        cols = [d[0] for d in cur.description]
        return pd.DataFrame(cur.fetchall(), columns=cols)


def columnas_tabla(conn):
    owner, tabla = TABLA.split(".")
    return set(_df(conn, "SELECT column_name FROM all_tab_columns WHERE owner = :o AND table_name = :t",
                   {"o": owner, "t": tabla}).COLUMN_NAME)


def encuestas(conn):
    """Respuestas con la lista blanca de columnas (+ nombres solo para limpiar comentarios)."""
    cols = ", ".join(COLUMNAS + COLUMNAS_SOLO_LIMPIEZA)
    return _df(conn, f"SELECT {cols} FROM {TABLA}")


def cuentas_repetidas(conn):
    """Encuestas de más por cuenta, por mes de respuesta y estudio. La cuenta no sale de Oracle."""
    return _df(conn, f"""
        SELECT TO_CHAR(RECORDEDDATE, 'YYYYMM') AS PERIODO, TIPO_ESTUDIO,
               COUNT(*) AS ENCUESTAS, COUNT(DISTINCT {CLAVE_CUENTA}) AS CUENTAS
          FROM {TABLA}
         GROUP BY TO_CHAR(RECORDEDDATE, 'YYYYMM'), TIPO_ESTUDIO""")
