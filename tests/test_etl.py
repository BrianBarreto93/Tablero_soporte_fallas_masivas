"""Pruebas del ETL. Las de cifras usan data/periodos/202610.json (se saltan si no existe)."""
import json

import pandas as pd
import pytest

from etl import agregar, calidad, dolores, verbatims
from etl.config import DIR_PERIODOS
from etl.limpiar import aliado, alinear_analitica, frase, limpiar, region, red, temas, texto_opcion


def _crudo(**over):
    base = dict(
        RESPONSEID="R_1", STARTDATE="2026-10-06 09:50:29", RECORDEDDATE=pd.Timestamp("2026-10-06 09:52:00"), FINISHED="Verdadero", FECHA="2026-10-01T00:00",
        FECHA_CARGA=pd.Timestamp("2026-11-09"), TIPO_ESTUDIO="Soporte", Q2="10", Q2_NPS_GROUP="Promotor",
        Q6="😄\n\nMuy fácil", Q5="😄 Feliz", Q8="Sí", Q9_1="😄 5", Q9_2="😊 4", Q9_3="😶 3", Q9_4=None,
        Q3=None, Q13=None, Q4="Excelente", Q7=None, Q10=None, Q4_SENTIMENT=None, Q4_TOPICS=None,
        Q7_SENTIMENT=None, Q7_TOPICS=None, DIVISION="REGION CENTRO", CIUDAD="BOGOTA", TIPO_RED="BIDIRECCIONAL",
        ESTRATO="3", MARCACION="SOPWRC", DES_MARCACION="FALLA TV SERVICIO DESAPROVISIONADO", ALIADO="CINCO S.A.S.",
        OPERACION="SOPORTE", RECIPIENTFIRSTNAME="Maria", RECIPIENTLASTNAME="Gomez")
    base.update(over)
    return pd.DataFrame([base])


# ------------------------------------------------------------------ limpieza
@pytest.mark.parametrize("crudo,esperado", [
    ("😄\n\nMuy fácil", "Muy fácil"), ("😶\n\nNi fácil ni difícil", "Ni fácil ni difícil"),
    ("MÃ³vil", "Móvil"), ("  ", None), (None, None), (float("nan"), None), ("😡 Enojado", "Enojado")])
def test_texto_opcion(crudo, esperado):
    assert texto_opcion(crudo) == esperado


def test_region_codigo_y_nombre():
    assert region("REGION NOROCCIDENTE") == ("Noroccidente", False)
    assert region("4") == ("Centro", True)
    assert region("9") == ("Sin dato", True)


def test_red_fecha_es_sin_dato():
    assert red("BIDIRECCIONAL") == "HFC" and red("FTT") == "FTTH"
    assert red("1/31/2025") == "Sin dato"


def test_aliado_unifica_sufijos():
    assert aliado("CINCO S.A.S.") == aliado("CINCO") == "CINCO"
    assert aliado("UNO 27") == aliado("UNO27")
    assert aliado("CONECTAR TV S.A.S.") == "CONECTAR TV"
    assert aliado("SICTE LTDA") == "SICTE"
    assert aliado(None) == "Sin dato"


def test_frase_respeta_siglas():
    assert frase("FALLA TV SERVICIO DESAPROVISIONADO") == "Falla TV servicio desaprovisionado"
    assert frase("SIN SEÑAL FALLA MASIVA (AVISO SAP)") == "Sin señal falla masiva (aviso SAP)"
    assert frase("TV ANALOGA") == "TV analoga"
    assert frase(None) == "Sin dato"


def test_temas_descarta_genericos():
    assert temas("Unknown") == []
    assert temas("Fallas Constantes,Sin Solución,No Aplica") == ["Fallas constantes", "Sin solución"]


def test_limpiar_fila():
    d = limpiar(_crudo())
    r = d.iloc[0]
    assert (r.periodo, r.semana, r.estudio) == ("202610", "2026-10-05", "Soporte")
    assert (r.q2, r.grupo, r.q6, r.q8, r.q9_1, r.q9_3) == (10, "Promotor", 5, 1, 5, 3)
    assert pd.isna(r.q9_4) and r.emocion == "Feliz" and r.red == "HFC" and r.aliado == "CINCO"


def test_alineacion_analitica_detecta_corrimiento():
    c = pd.concat([_crudo(Q7="difícil", Q4_SENTIMENT="Negative", Q4_TOPICS="Sin Solución"),
                   _crudo(RESPONSEID="R_2", Q7=None, Q10="mejorar", Q7_SENTIMENT="Negative", Q7_TOPICS="Dar Solución")],
                  ignore_index=True)
    assert alinear_analitica(c) == {"Q4": "Q7", "Q7": "Q10"}
    d = limpiar(c)
    assert d.temas_dificil[0] == ["Sin solución"] and d.temas_mejora[1] == ["Dar solución"]
    assert list(d.com_q7) == [1, 0] and list(d.com_q10) == [0, 1]


# ------------------------------------------------------------------ contrato de calidad
def _errores(crudo):
    return {c["id"] for c in calidad.evaluar(crudo, limpiar(crudo)) if c["nivel"] == "error"}


def test_calidad_limpia_sin_errores():
    assert _errores(_crudo()) == set()


@pytest.mark.parametrize("over,id_", [
    (dict(Q2="11"), "q2_rango"), (dict(Q2="abc"), "q2_rango"),
    (dict(Q2_NPS_GROUP="Detractor"), "q2_grupo"), (dict(Q6="Regular"), "q6_catalogo"),
    (dict(Q8="Tal vez"), "q8_catalogo"), (dict(TIPO_ESTUDIO="Instalación"), "estudio")])
def test_calidad_bloquea(over, id_):
    assert id_ in _errores(_crudo(**over))


def test_calidad_bloquea_ids_repetidos():
    assert "id_unico" in _errores(pd.concat([_crudo(), _crudo()], ignore_index=True))


def test_esquema_incompleto():
    with pytest.raises(calidad.ErrorCalidad):
        calidad.esquema({"RESPONSEID", "Q2"})


# ------------------------------------------------------------------ datos personales
def test_tapar_y_escanear():
    t = verbatims.tapar("Soy maria, el técnico Pedro Pérez no vino; cuenta 1234567 tel 300 123 4567 x@y.com",
                        ["Maria", "Gomez"])
    assert "maria" not in t.lower() and "Pedro" not in t and "1234567" not in t and "@" not in t
    assert calidad.escanear_pii([(t, ["Maria", "Gomez"])]) == []
    assert calidad.escanear_pii([("llamar al 3001234567", [])])
    assert calidad.escanear_pii([("escriban a x@y.com", [])])
    assert calidad.escanear_pii([("gracias Maria", ["Maria"])])


def test_cifras_cortas_se_conservan():
    assert verbatims.tapar("esperé 45 minutos y 3 días", []) == "esperé 45 minutos y 3 días"


# ------------------------------------------------------------------ cubo
def test_cubo_suma_conteos():
    c = pd.concat([_crudo(), _crudo(RESPONSEID="R_2", Q2="3", Q2_NPS_GROUP="Detractor", Q6="😢\n\nMuy difícil", Q8="No")],
                  ignore_index=True)
    filas = agregar.cubo(limpiar(c))
    tot = [sum(col) for col in zip(*[f["m"] for f in filas])]
    m = dict(zip(agregar.MEDIDAS, tot))
    assert (m["n"], m["prom"], m["det"], m["q6_5"], m["q6_1"], m["q8_si"], m["q8_no"]) == (2, 1, 1, 1, 1, 1, 1)
    assert (m["prom_si"], m["det_no"], m["q9_1_top2"], m["q9_4_val"]) == (1, 1, 2, 0)


# ------------------------------------------------------------------ cifras de referencia (oct-2026)
OCT = DIR_PERIODOS / "202610.json"


@pytest.mark.skipif(not OCT.exists(), reason="sin data/periodos/202610.json")
@pytest.mark.parametrize("estudio,n,nps,ces,q8", [("Soporte", 536, -22.9, 42.2, 47.9), ("Falla masiva", 257, -38.1, 34.2, 54.0)])
def test_cifras_octubre(estudio, n, nps, ces, q8):
    s = json.loads(OCT.read_text(encoding="utf-8"))
    tot = [sum(c) for c in zip(*[f["m"] for f in s["filas"] if f["d"]["estudio"] == estudio])]
    m = dict(zip(agregar.MEDIDAS, tot))
    assert m["n"] == n
    assert round((m["prom"] - m["det"]) / m["n"] * 100, 1) == nps
    assert round((m["q6_4"] + m["q6_5"]) / sum(m[f"q6_{i}"] for i in range(1, 6)) * 100, 1) == ces
    assert round(m["q8_si"] / (m["q8_si"] + m["q8_no"]) * 100, 1) == q8


@pytest.mark.skipif(not OCT.exists(), reason="sin data/periodos/202610.json")
def test_salida_sin_datos_personales():
    js = (DIR_PERIODOS.parent.parent / "tablero" / "comentarios.js").read_text(encoding="utf-8")
    datos = json.loads(js[len("window.COMENTARIOS="):].rstrip().rstrip(";"))
    textos = [v[-1] for v in datos["filas"]]
    assert calidad.escanear_pii([(t, []) for t in textos]) == []
    assert not calidad._CORREO.search(js)


# Serie CES Soporte ene–sep validada contra el Power BI del usuario (2026-10-15) y Falla masiva may–sep
@pytest.mark.parametrize("estudio,serie", [
    ("Soporte", {"202601": 43.0, "202602": 41.0, "202603": 39.5, "202604": 37.8, "202605": 36.9, "202606": 33.6,
                 "202607": 33.6, "202608": 36.4, "202609": 41.7}),
    ("Falla masiva", {"202605": 25.1, "202606": 30.7, "202607": 27.0, "202608": 25.8, "202609": 28.0})])
def test_ces_historico_cuadra_con_power_bi(estudio, serie):
    for p, ces in serie.items():
        f = DIR_PERIODOS / f"{p}.json"
        if not f.exists():
            pytest.skip(f"sin {p}")
        s = json.loads(f.read_text(encoding="utf-8"))
        tot = [sum(c) for c in zip(*[r["m"] for r in s["filas"] if r["d"]["estudio"] == estudio])]
        m = dict(zip(agregar.MEDIDAS, tot))
        assert round((m["q6_4"] + m["q6_5"]) / sum(m[f"q6_{i}"] for i in range(1, 6)) * 100, 1) == ces, p


@pytest.mark.skipif(not OCT.exists(), reason="sin data/periodos/202610.json")
def test_base_descargable():
    from etl import base
    for f in sorted(DIR_PERIODOS.glob("*.json")):
        s = json.loads(f.read_text(encoding="utf-8"))
        assert len(s["base"]) == s["n"], f.name                      # una fila por encuesta
        assert all(len(r) == len(base.COLUMNAS) for r in s["base"])
        textos = [v for r in s["base"] for v in r[-len(base.ABIERTAS):] if v]
        assert calidad.escanear_pii([(t, []) for t in textos]) == [], f.name
    prohibidas = {"cuenta", "teléfono", "telefono", "correo", "cédula", "identificación", "nombre"}
    assert not [c for c in base.COLUMNAS if any(p in c.lower() for p in prohibidas)]


# ------------------------------------------------------------------ dolores
def test_dolores_reglas_y_cubo():
    c = pd.concat([_crudo(Q3="Nadie contesta y se corta la llamada"),
                   _crudo(RESPONSEID="R_2", Q2="2", Q2_NPS_GROUP="Detractor", Q8="No", Q13="Llevo 8 días sin internet")],
                  ignore_index=True)
    d = limpiar(c)
    m = dolores.marcar(c, d)
    assert m.loc[0, "contacto"] and not m.loc[0, "persiste"]
    assert m.loc[1, "persiste"] and m.loc[1, "tiempo"] and m.alguno.all()
    filas = agregar.cubo(d, m)
    dl = {}
    for f in filas:
        for k, v in f.get("dl", {}).items():
            dl[k] = [a + b for a, b in zip(dl.get(k, [0] * 5), v)]
    assert dl["persiste"] == [1, 0, 1, 1, 1] and dl["alguno"][0] == 2


# Deck «Dolores del cliente · Soporte y Fallas masivas Hogar» (ene–ago 2026, misma taxonomía):
# encuestas con el dolor y brecha de NPS (sin − con) redondeada
@pytest.mark.parametrize("estudio,clave,n,brecha", [
    ("Soporte", "contacto", 1348, 59), ("Soporte", "visita", 782, 64), ("Soporte", "persiste", 4791, 131),
    ("Falla masiva", "aviso", 340, 37), ("Falla masiva", "tiempo", 1162, 49), ("Falla masiva", "persiste", 2244, 93)])
def test_dolores_cuadran_con_deck(estudio, clave, n, brecha):
    tot, con = [0] * 3, [0] * 3
    for p in [f"2026{m:02d}" for m in range(1, 9)]:
        f = DIR_PERIODOS / f"{p}.json"
        if not f.exists():
            pytest.skip(f"sin {p}")
        for r in json.loads(f.read_text(encoding="utf-8"))["filas"]:
            if r["d"]["estudio"] != estudio:
                continue
            tot = [a + b for a, b in zip(tot, r["m"][:3])]
            if clave in r.get("dl", {}):
                con = [a + b for a, b in zip(con, r["dl"][clave][:3])]
    sin = [a - b for a, b in zip(tot, con)]
    nps = lambda x: (x[1] - x[2]) / x[0] * 100
    assert con[0] == n
    assert round(nps(sin) - nps(con)) == brecha
