"""Comentarios abiertos limpios. Se tapan: correos, cifras de 5+ dígitos (cuentas, teléfonos, cédulas),
el nombre y apellido del propio encuestado y los nombres propios que siguen a «técnico», «asesor», «señor»…
"""
import re

import pandas as pd

from etl.config import ABIERTAS, MAX_VERBATIMS_PERIODO
from etl.limpiar import texto_opcion

_NO_NOMBRE = {"DE", "DEL", "LA", "LAS", "LOS", "Y", "SAN", "SANTA", "VDA", "VIUDA"}
_CORREO = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_CIFRA = re.compile(r"\d(?:[\d .-]{3,}\d)")  # 5+ caracteres empezando y terminando en dígito
_ROL = re.compile(
    r"\b((?i:(?:el|la|al|un|una)?\s*(?:t[ée]cnic[oa]s?|asesor(?:a|es)?|se[ñn]or(?:a|ita)?|sr\.?|sra\.?|don|do[ñn]a|"
    r"ingenier[oa]|agente|funcionari[oa]|llamad[oa]|de nombre))\s+)"
    r"([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,2})")
_MINIMO = 3  # caracteres útiles para considerar que hay comentario


def tokens_nombre(*partes):
    out = []
    for p in partes:
        for t in re.split(r"[\s,.-]+", str(p or "")):
            if len(t) >= 3 and t.upper() not in _NO_NOMBRE and not t.isdigit():
                out.append(t)
    return out


def tapar(texto, nombres=()):
    s = _CORREO.sub("[correo]", texto)
    s = _CIFRA.sub(lambda m: "[#]" if sum(c.isdigit() for c in m.group()) >= 5 else m.group(), s)
    for nom in sorted(set(nombres), key=len, reverse=True):
        s = re.sub(rf"\b{re.escape(nom)}\b", "[nombre]", s, flags=re.I)
    s = _ROL.sub(lambda m: m.group(1) + "[nombre]", s)
    return re.sub(r"\s+", " ", s).strip()


def _q9(d, i):
    """Promedio de las calificaciones del asesor (1–5) de la encuesta, para elegir ejemplos del asesor."""
    v = [d.at[i, f"q9_{k}"] for k in range(1, 5) if pd.notna(d.at[i, f"q9_{k}"])]
    return round(sum(v) / len(v), 1) if v else None


def construir(crudo, d):
    """Lista de comentarios del periodo: dims de filtro + grupo NPS + Q8 + pregunta + texto limpio.
    También devuelve (texto, nombres) para el escaneo de datos personales."""
    filas, escaneo = [], []
    for i in d.index:
        nombres = tokens_nombre(crudo.at[i, "RECIPIENTFIRSTNAME"], crudo.at[i, "RECIPIENTLASTNAME"])
        for q in ABIERTAS:
            t = texto_opcion(crudo.at[i, q])
            if not t or sum(c.isalpha() for c in t) < _MINIMO:
                continue
            limpio = tapar(t, nombres)
            escaneo.append((limpio, nombres))
            filas.append({
                "periodo": d.at[i, "periodo"], "semana": d.at[i, "semana"], "estudio": d.at[i, "estudio"],
                "region": d.at[i, "region"], "red": d.at[i, "red"], "marcacion": d.at[i, "marcacion"],
                "aliado": d.at[i, "aliado"], "operacion": d.at[i, "operacion"], "estrato": d.at[i, "estrato"],
                "grupo": d.at[i, "grupo"], "q8": None if pd.isna(d.at[i, "q8"]) else int(d.at[i, "q8"]),
                "q6": None if pd.isna(d.at[i, "q6"]) else int(d.at[i, "q6"]),
                "q2": int(d.at[i, "q2"]) if pd.notna(d.at[i, "q2"]) else None,
                "q9": _q9(d, i),
                "pregunta": q, "texto": limpio,
            })
    # Si algún mes trae muchísimos, muestra aleatoria fija (semilla) para no sesgar hacia ningún tipo de comentario
    if len(filas) > MAX_VERBATIMS_PERIODO:
        import random
        filas = random.Random(20261111).sample(filas, MAX_VERBATIMS_PERIODO)
    return filas, escaneo
