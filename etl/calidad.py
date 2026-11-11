"""Contrato de datos. Cada chequeo devuelve {id, nivel, titulo, detalle, n}.
nivel = 'error' → la corrida se detiene y no se publica; 'aviso' → se muestra en la pestaña Calidad; 'ok'.
"""
import re

import pandas as pd

from etl.config import COLUMNAS, ESTUDIOS, Q6_ESCALA, Q8_VALIDOS, SIN_DATO, VARIACION_N_AVISO


class ErrorCalidad(RuntimeError):
    pass


def _chk(id_, nivel, titulo, detalle, n=0):
    return {"id": id_, "nivel": nivel, "titulo": titulo, "detalle": detalle, "n": int(n)}


def num(n):
    return f"{int(n):,}".replace(",", ".")


def _pct(a, b):
    if not b:
        return "0"
    return f"{num(a)} de {num(b)} (" + f"{a / b * 100:.1f}".replace(".", ",") + " %)"


def esquema(columnas_oracle):
    faltan = sorted(set(COLUMNAS) - set(columnas_oracle))
    if faltan:
        raise ErrorCalidad(f"Faltan columnas en la tabla fuente: {', '.join(faltan)}")


def evaluar(crudo, d, repetidas=None, n_anterior=None):
    """Chequeos de UN periodo (crudo y d ya filtrados a ese periodo)."""
    n = len(d)
    out = []

    dup = crudo.RESPONSEID.duplicated().sum()
    out.append(_chk("id_unico", "error" if dup else "ok", "Una fila por respuesta (RESPONSEID)",
                    f"{dup} RESPONSEID repetidos" if dup else "Sin repetidos", dup))

    malos = d.q2.isna().sum()
    out.append(_chk("q2_rango", "error" if malos else "ok", "Recomendación (Q2) entre 0 y 10",
                    f"{malos} respuestas fuera de rango o vacías" if malos else "Todas válidas", malos))

    inc = ((d.grupo_fuente.notna()) & (d.grupo != d.grupo_fuente)).sum()
    out.append(_chk("q2_grupo", "error" if inc else "ok", "Grupo NPS de Qualtrics coincide con Q2",
                    f"{inc} filas con grupo distinto al que da la nota" if inc else "Coincide en todas", inc))

    for col, txt, cat, titulo in [("q6", "q6_txt", Q6_ESCALA, "Facilidad (Q6) dentro del catálogo"),
                                  ("q8", "q8_txt", Q8_VALIDOS, "Servicio funcionando (Q8) es Sí/No")]:
        fuera = (d[txt].notna() & d[col].isna()).sum()
        ejemplos = ", ".join(sorted(d.loc[d[txt].notna() & d[col].isna(), txt].unique())[:3])
        out.append(_chk(f"{col}_catalogo", "error" if fuera else "ok", titulo,
                        f"{fuera} valores fuera del catálogo: {ejemplos}" if fuera else "Todos en el catálogo", fuera))

    fuera = (~d.estudio.isin(ESTUDIOS)).sum()
    out.append(_chk("estudio", "error" if fuera else "ok", "TIPO_ESTUDIO es Soporte o Falla masiva",
                    f"{fuera} filas con otro estudio" if fuera else "Todas válidas", fuera))

    # ---- avisos
    alt = int(d.formato_alterno.sum())
    out.append(_chk("formato_alterno", "aviso" if alt else "ok", "Filas con formato alterno (división en código)",
                    f"{_pct(alt, n)}: DIVISION llega como código y TIPO_RED trae una fecha. La región se "
                    "reconstruye con el código; la red queda «Sin dato».", alt))
    for col, titulo in [("region", "Región sin dato"), ("red", "Tipo de red sin dato"), ("aliado", "Aliado sin dato"),
                        ("operacion", "Operación sin dato")]:
        k = int((d[col] == SIN_DATO).sum())
        out.append(_chk(f"{col}_sin_dato", "aviso" if k else "ok", titulo, _pct(k, n), k))

    sin_q6 = int(d.q6_txt.isna().sum())
    out.append(_chk("q6_vacio", "aviso" if sin_q6 else "ok", "Sin respuesta de facilidad (Q6)", _pct(sin_q6, n), sin_q6))
    inc_ = int((~d.terminada).sum())
    out.append(_chk("incompletas", "aviso" if inc_ else "ok", "Encuestas sin terminar",
                    f"{_pct(inc_, n)}. Cuentan para NPS y CES; no tienen Q8 ni Q9, por eso cada indicador usa "
                    "sus propias respuestas válidas como base.", inc_))

    dias = (pd.to_datetime(crudo.STARTDATE, errors="coerce") - d.fecha_contacto).dt.days
    raro = int(((dias < 0) | (dias > 45) | dias.isna()).sum())
    out.append(_chk("fecha_contacto", "aviso" if raro else "ok", "Fecha de contacto coherente con la encuesta",
                    f"{raro} encuestas con FECHA vacía, posterior a la respuesta o de más de 45 días antes"
                    if raro else f"Encuesta entre {int(dias.min())} y {int(dias.max())} días después del contacto", raro))

    if repetidas is not None and len(repetidas):
        extra = int((repetidas.ENCUESTAS - repetidas.CUENTAS).sum())
        out.append(_chk("cuentas_repetidas", "aviso" if extra else "ok", "Cuentas con más de una encuesta",
                        f"{extra} encuestas de más sobre la misma cuenta y estudio. Se conservan: la unidad del "
                        "tablero es la encuesta.", extra))

    if n_anterior:
        var = n / n_anterior - 1
        nivel = "aviso" if abs(var) > VARIACION_N_AVISO else "ok"
        out.append(_chk("volumen", nivel, "Volumen frente al mes anterior",
                        f"{num(n)} encuestas vs {num(n_anterior)} ({var * 100:+.0f} %)", n))
    return out


# ------------------------------------------------------------------ escaneo de datos personales en la salida
_CORREO = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_DIGITOS = re.compile(r"\d[\d .-]{5,}\d")  # 7+ dígitos, aunque vengan con espacios o guiones


def escanear_pii(items):
    """items = [(texto, nombres_del_encuestado), …]. Devuelve los hallazgos (lista vacía = limpio)."""
    hall = []
    for t, nombres in items:
        if not t:
            continue
        if _CORREO.search(t):
            hall.append(("correo", t[:60]))
        if any(sum(c.isdigit() for c in m.group()) >= 7 for m in _DIGITOS.finditer(t)):
            hall.append(("número largo", t[:60]))
        for nom in nombres or ():
            if nom and len(nom) >= 3 and re.search(rf"\b{re.escape(nom)}\b", t, re.I):
                hall.append(("nombre del encuestado", t[:60]))
                break
    return hall
