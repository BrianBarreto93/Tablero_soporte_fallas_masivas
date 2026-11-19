"""Clasificación de red de cada encuesta para la base descargable: HFC, FTTH propia, FTTH neutra o DTH.

- HFC / FTTH / DTH: la red que trae la propia encuesta (TIPO_RED, red al momento de responder). En el cruce con el DWH
  (nov-2026) ~890 cuentas que hoy son FTTH respondieron antes de migrar y la fuente las tiene bien como HFC.
- Propia o neutra (solo FTTH): Yellowbrick DWH_DB.CLIENTES.VW_CLIEN_SERVICIOS_FTTH (des_tipo_red FTT = propia,
  RED NEUTRA = neutra) por cuenta; si la cuenta ya no está (canceladas), por el nodo de la encuesta: en la vista cada
  nodo es 100 % propio o 100 % neutro (90 mil nodos, nov-2026).
- Red «Sin dato» (formato alterno de la fuente): la vista por cuenta, si ya era FTTH en la fecha de la encuesta.

Trampa: en esta vista un IN (...) de más de 8 cuentas devuelve filas de menos SIN error (5.000 cuentas → 8 de 2.433).
Por eso se baja la parte FTTH de la vista completa (~1,7 M filas, ~10 s) y se cruza en pandas.
Credenciales: YELLOWBRICK_* del .env del proyecto (Windows) o, si no están, del .env de claro_CR_Recurrencia en el servidor
(las del .env propio del servidor fallan por LDAP desde nov-2026).
"""
import pandas as pd
import psycopg2
from dotenv import dotenv_values

from etl.config import RAIZ, SIN_DATO

ENV_YB = "/opt/apps/claro_CR_Recurrencia/.env"
FTTH = {"FTT": "FTTH propia", "RED NEUTRA": "FTTH neutra"}
SIN_CLASIFICAR = "FTTH sin clasificar"


def cargar():
    """{'cuentas': DataFrame(clase, desde) por cuenta, 'nodos': Series nodo → clase}."""
    e = {**dotenv_values(ENV_YB), **{k: v for k, v in dotenv_values(RAIZ / ".env").items() if v}}
    c = psycopg2.connect(host=e["YELLOWBRICK_HOST"], port=int(e["YELLOWBRICK_PORT"]), dbname="dwh_db",
                         user=e["YELLOWBRICK_USER"], password=e["YELLOWBRICK_PASSWORD"], connect_timeout=30)
    try:
        with c.cursor() as cur:
            cur.execute("""SELECT cod_cuenta, cod_nodo, des_tipo_red, fec_instalacion, fec_visita_ftth
                             FROM dwh_db.clientes.vw_clien_servicios_ftth WHERE des_tipo_red IN ('FTT', 'RED NEUTRA')""")
            v = pd.DataFrame(cur.fetchall(), columns=["cuenta", "nodo", "red", "fi", "fv"])
    finally:
        c.close()
    v["clase"] = v.red.map(FTTH)
    # FTTH desde la menor entre instalación y visita (fec_instalacion sola se reescribe en migraciones masivas)
    v["desde"] = pd.concat([pd.to_datetime(v.fi, errors="coerce"), pd.to_datetime(v.fv, errors="coerce")], axis=1).min(axis=1)
    nodos = (v.groupby(["nodo", "clase"]).size().reset_index(name="n").sort_values("n")
             .drop_duplicates("nodo", keep="last").set_index("nodo").clase)
    return {"cuentas": v.drop_duplicates("cuenta").set_index("cuenta")[["clase", "desde"]], "nodos": nodos}


def clasificar(crudo, d, yb):
    """Serie (índice de d) con la clasificación. Sin Yellowbrick (yb None), FTTH queda sin dividir."""
    out = d.red.where(d.red != "FTTH", SIN_CLASIFICAR) if yb is None else d.red.copy()
    if yb is None:
        return out
    cta = pd.to_numeric(crudo.loc[d.index, "NUMERO_CUENTA"], errors="coerce")
    porc = yb["cuentas"].reindex(cta.values).set_axis(d.index)
    nodo = crudo.loc[d.index, "NODO"].map(yb["nodos"])
    ftth, sd = d.red.eq("FTTH"), d.red.eq(SIN_DATO)
    out[ftth] = porc.clase[ftth].fillna(nodo[ftth]).fillna(SIN_CLASIFICAR)
    ya = porc.desde <= pd.to_datetime(crudo.loc[d.index, "RECORDEDDATE"]).dt.normalize()
    out[sd] = porc.clase.where(ya)[sd].fillna(SIN_DATO)
    return out
