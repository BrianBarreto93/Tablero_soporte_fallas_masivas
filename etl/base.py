"""Base descargable: una fila por encuesta, sin datos personales (sin nombre, teléfono, correo, cédula ni cuenta).
Los comentarios van con los mismos tapados que los verbatims. El tablero la filtra con los filtros activos.
"""
import pandas as pd

from etl.config import ABIERTAS, Q9_ATRIBUTOS, SIN_DATO
from etl.limpiar import texto_opcion
from etl.verbatims import tapar, tokens_nombre

# (nombre de la columna, función que la arma). Las numéricas y de fecha deben coincidir con tablero/exportar.js
CORTOS_Q9 = {"Q9_1": "Profesionalismo (1-5)", "Q9_2": "Amabilidad (1-5)", "Q9_3": "Claridad (1-5)", "Q9_4": "Tiempo de atención (1-5)"}
COLUMNAS = (["ID respuesta", "Fecha respuesta", "Fecha contacto", "Mes", "Estudio", "Región", "Ciudad", "Tipo de red", "Estrato",
             "Código marcación", "Marcación", "Gerencia", "Operación", "Detalle operación", "Aliado",
             "Recomendación (0-10)", "Grupo NPS", "Facilidad", "Facilidad (1-5)", "Servicio funcionando"]
            + [CORTOS_Q9[q] for q in Q9_ATRIBUTOS]
            + ["Emoción", "Encuesta terminada", "Temas: qué fue difícil", "Temas: cómo mejorar al asesor"]
            + [ABIERTAS[q] for q in ABIERTAS])
# Columnas con las que el tablero filtra la base (dimensión del cubo → columna)
FILTRO = {"periodo": "Mes", "estudio": "Estudio", "region": "Región", "red": "Tipo de red",
          "marcacion": "Marcación", "aliado": "Aliado", "operacion": "Operación"}


def _n(v):
    return "" if v is None or pd.isna(v) else str(int(v))


def _s(v):
    return v if isinstance(v, str) else ""


def _t(v):
    s = texto_opcion(v)
    return s if s and s.upper() not in {"0", "NULL", "NAN"} else ""


def construir(crudo, d):
    """Devuelve (filas, escaneo): filas en el orden de COLUMNAS; escaneo = [(texto, nombres)] para calidad.escanear_pii."""
    filas, escaneo = [], []
    fr = pd.to_datetime(crudo.RECORDEDDATE, errors="coerce")
    for i in d.index:
        nombres = tokens_nombre(crudo.at[i, "RECIPIENTFIRSTNAME"], crudo.at[i, "RECIPIENTLASTNAME"])
        com = []
        for q in ABIERTAS:
            t = texto_opcion(crudo.at[i, q])
            t = tapar(t, nombres) if t else ""
            if t:
                escaneo.append((t, nombres))
            com.append(t)
        p = d.at[i, "periodo"]
        fila = [
            _t(crudo.at[i, "RESPONSEID"]),
            fr[i].strftime("%Y-%m-%d %H:%M:%S") if pd.notna(fr[i]) else "",
            d.at[i, "fecha_contacto"].strftime("%Y-%m-%d") if pd.notna(d.at[i, "fecha_contacto"]) else "",
            f"{p[:4]}-{p[4:]}", d.at[i, "estudio"], d.at[i, "region"], _t(crudo.at[i, "CIUDAD"]).split("/")[0].strip(),
            d.at[i, "red"], d.at[i, "estrato"],
            _t(crudo.at[i, "MARCACION"]), d.at[i, "marcacion"], _t(crudo.at[i, "GERENCIA"]), d.at[i, "operacion"],
            _t(crudo.at[i, "DES_OPERACION"]), d.at[i, "aliado"],
            _n(d.at[i, "q2"]), d.at[i, "grupo"] if isinstance(d.at[i, "grupo"], str) else "",
            _s(d.at[i, "q6_txt"]), _n(d.at[i, "q6"]),
            {1: "Sí", 0: "No"}.get(None if pd.isna(d.at[i, "q8"]) else int(d.at[i, "q8"]), ""),
            *[_n(d.at[i, q.lower()]) for q in Q9_ATRIBUTOS],
            _s(d.at[i, "emocion"]), "Sí" if d.at[i, "terminada"] else "No",
            ", ".join(d.at[i, "temas_dificil"]), ", ".join(d.at[i, "temas_mejora"]),
            *com,
        ]
        filas.append([SIN_DATO if v is None else v for v in fila])
    return filas, escaneo
