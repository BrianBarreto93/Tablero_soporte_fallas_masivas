"""Normalización de la encuesta cruda. Una fila de entrada = una fila de salida (nunca descarta encuestas);
lo que no se puede interpretar queda en None / «Sin dato» y lo cuenta calidad.py.
"""
import re
import unicodedata

import pandas as pd

from etl.config import (ABIERTAS, DIVISION_CODIGO, EMOCIONES, Q6_ESCALA, Q8_VALIDOS, Q9_ATRIBUTOS,
                        SIN_DATO, SUFIJOS_ALIADO, TIPO_RED)

_PREFIJO = re.compile(r"^[^\wÁÉÍÓÚÜÑáéíóúüñ]+")
_SIGLAS = {"TV", "SAP", "FTTH", "WIFI", "DTH", "DHCP", "DNS", "TF", "HFC", "UMM", "SAC", "CAV", "SWAT"}


def texto_opcion(v):
    """'😄\\n\\nMuy fácil' → 'Muy fácil'; 'MÃ³vil' → 'Móvil'. None si viene vacío."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v)
    if "Ã" in s:  # UTF-8 leído como Latin-1 en la carga
        try:
            s = s.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    s = unicodedata.normalize("NFC", _PREFIJO.sub("", s))
    s = re.sub(r"\s+", " ", s).strip()
    return s or None


def a_entero(v, lo, hi):
    s = texto_opcion(v)
    if s is None or not re.fullmatch(r"-?\d+(\.0+)?", s):
        return None
    n = int(float(s))
    return n if lo <= n <= hi else None


def frase(s):
    """'FALLA TV SERVICIO DESAPROVISIONADO' → 'Falla TV servicio desaprovisionado'."""
    if not isinstance(s, str) or not s:
        return SIN_DATO
    palabras = s.split()
    sigla = lambda p: re.sub(r"\W", "", p).upper() in _SIGLAS
    out = [p.upper() if sigla(p) else p.lower() for p in palabras]
    if not sigla(out[0]):
        out[0] = out[0][:1].upper() + out[0][1:]
    return " ".join(out)


def region(v):
    s = texto_opcion(v)
    if not s:
        return SIN_DATO, False
    if s.upper().startswith("REGION "):
        return s[7:].strip().title(), False
    return DIVISION_CODIGO.get(s, SIN_DATO), True  # formato alterno: la división viene como código


def red(v):
    s = (texto_opcion(v) or "").upper()
    return TIPO_RED.get(s, SIN_DATO)


def aliado(v):
    s = texto_opcion(v)
    if not s or s in {"0", "NULL"}:
        return SIN_DATO
    s = re.sub(SUFIJOS_ALIADO, "", s.upper()).strip(" .,")
    return re.sub(r"(?<=[A-Z])\s+(?=\d)", "", s)  # «UNO 27» → «UNO27»


def temas(v):
    s = texto_opcion(v)
    if not s:
        return []
    out = []
    for t in s.split(","):
        t = t.strip()
        if t and t not in {"Unknown", "No Aplica", "No indica"}:
            t = t[:1].upper() + t[1:].lower()  # «Menú Extenso» → «Menú extenso»
            if t not in out:
                out.append(t)
    return out


def alinear_analitica(df):
    """Qualtrics guarda la analítica de texto (temas) con el prefijo de otra pregunta: en oct-2026 las
    columnas Q4_* corresponden a Q7 y las Q7_* a Q10. Se detecta por qué abierta tiene exactamente las
    mismas filas con dato. Devuelve {prefijo_analitica: pregunta_abierta} solo si coincide en ≥ 98 %."""
    out = {}
    for pref in ("Q4", "Q7"):
        col = f"{pref}_SENTIMENT"
        if col not in df or df[col].notna().sum() == 0:
            continue
        mejor, tasa = None, 0.0
        for q in ABIERTAS:
            t = (df[q].notna() == df[col].notna()).mean()
            if t > tasa:
                mejor, tasa = q, t
        if tasa >= 0.98:
            out[pref] = mejor
    return out


def limpiar(crudo):
    d = pd.DataFrame(index=crudo.index)
    # Periodo = mes de RECORDEDDATE (DATE en Oracle): coincide 100 % con el mes de los exportes oficiales de
    # Qualtrics ene–sep 2026, con los que se validó el Power BI. STARTDATE se sale del mes en ~1 % de las filas.
    inicio = pd.to_datetime(crudo.RECORDEDDATE, errors="coerce")
    d["periodo"] = inicio.dt.strftime("%Y%m")
    d["semana"] = (inicio.dt.normalize() - pd.to_timedelta(inicio.dt.day_of_week, unit="D")).dt.strftime("%Y-%m-%d")
    d["fecha_contacto"] = pd.to_datetime(crudo.FECHA, errors="coerce")
    d["estudio"] = crudo.TIPO_ESTUDIO.map(texto_opcion)
    d["terminada"] = crudo.FINISHED.map(texto_opcion).isin(["Verdadero", "True", "1"])

    d["q2"] = pd.to_numeric(crudo.Q2.map(lambda v: a_entero(v, 0, 10)), errors="coerce")
    d["grupo_fuente"] = crudo.Q2_NPS_GROUP.map(texto_opcion)
    d["grupo"] = pd.cut(d.q2, [-1, 6, 8, 10], labels=["Detractor", "Pasivo", "Promotor"]).astype(object)
    d["q6_txt"] = crudo.Q6.map(texto_opcion)
    d["q6"] = pd.to_numeric(d.q6_txt.map(Q6_ESCALA), errors="coerce")
    d["q8_txt"] = crudo.Q8.map(texto_opcion)
    d["q8"] = pd.to_numeric(d.q8_txt.map(Q8_VALIDOS), errors="coerce")
    for q in Q9_ATRIBUTOS:
        d[q.lower()] = pd.to_numeric(crudo[q].map(lambda v: a_entero(v, 1, 5)), errors="coerce")
    d["emocion"] = crudo.Q5.map(lambda v: texto_opcion(v) if texto_opcion(v) in EMOCIONES else None)

    reg = crudo.DIVISION.map(region)
    d["region"] = reg.str[0]
    d["formato_alterno"] = reg.str[1].astype(bool)
    d["red"] = crudo.TIPO_RED.map(red)
    d["estrato"] = crudo.ESTRATO.map(lambda v: a_entero(v, 1, 6)).map(lambda n: SIN_DATO if pd.isna(n) else str(int(n)))
    d["marcacion"] = crudo.DES_MARCACION.map(lambda v: frase(texto_opcion(v)))
    d["aliado"] = crudo.ALIADO.map(aliado)
    d["operacion"] = crudo.OPERACION.map(lambda v: frase(texto_opcion(v)))

    # Temas de la analítica de Qualtrics, reasignados a la pregunta a la que de verdad pertenecen
    alineacion = alinear_analitica(crudo)
    d["temas_dificil"] = [[] for _ in range(len(d))]
    d["temas_mejora"] = [[] for _ in range(len(d))]
    for pref, q in alineacion.items():
        destino = {"Q7": "temas_dificil", "Q10": "temas_mejora"}.get(q)
        if destino:
            d[destino] = crudo[f"{pref}_TOPICS"].map(temas)
    d["com_q7"] = crudo.Q7.map(lambda v: texto_opcion(v) is not None).astype(int)
    d["com_q10"] = crudo.Q10.map(lambda v: texto_opcion(v) is not None).astype(int)
    d.attrs["alineacion_analitica"] = alineacion
    return d
