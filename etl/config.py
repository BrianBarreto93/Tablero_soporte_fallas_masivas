"""Constantes del tablero: tabla fuente, lista blanca de columnas, catálogos y umbrales.

Todo lo que cambie de un corte a otro (nombres de aliados, códigos de división…) se ajusta aquí,
no en la lógica.
"""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
TABLA = "INVITADO_15.TBL_ENC_SOPORTE_FALLAS"
DIR_PERIODOS = RAIZ / "data" / "periodos"     # un JSON agregado por mes (histórico acumulado)
SALIDA_JS = RAIZ / "tablero" / "datos.js"
DIR_CONTACTO = RAIZ / "tablero" / "contacto"  # cuenta, teléfono y correo por mes (en .gitignore)

# Columnas que el ETL lee. Nunca SELECT *: la tabla trae nombres, correo, teléfonos, cédula, IP,
# coordenadas y login del asesor. Los nombres del encuestado se leen SOLO para taparlos en los
# comentarios y se descartan en memoria (ver verbatims.py); no llegan a la salida.
# Cuenta, teléfono y correo (COLUMNAS_CONTACTO) van SOLO a tablero/contacto/ (base descargable, fuera de git).
COLUMNAS = [
    "RESPONSEID", "STARTDATE", "RECORDEDDATE", "FINISHED", "FECHA", "FECHA_CARGA",
    "TIPO_ESTUDIO", "Q2", "Q2_NPS_GROUP", "Q6", "Q5", "Q8", "Q9_1", "Q9_2", "Q9_3", "Q9_4",
    "Q3", "Q13", "Q4", "Q7", "Q10",
    "Q4_SENTIMENT", "Q4_TOPICS", "Q7_SENTIMENT", "Q7_TOPICS",
    "DIVISION", "CIUDAD", "TIPO_RED", "ESTRATO", "MARCACION", "DES_MARCACION", "ALIADO", "OPERACION",
    "GERENCIA", "DES_OPERACION", "NODO",
]
COLUMNAS_CONTACTO = ["NUMERO_CUENTA", "RECIPIENTPHONE", "RECIPIENTEMAIL"]
COLUMNAS_SOLO_LIMPIEZA = ["RECIPIENTFIRSTNAME", "RECIPIENTLASTNAME"]
# Para contar cuentas repetidas sin sacar la cuenta de Oracle (se agrega en SQL)
CLAVE_CUENTA = "NUMERO_CUENTA"

ESTUDIOS = ["Soporte", "Falla masiva"]

# Q6 «¿Qué tan fácil fue contactarse con un asesor…?» → escala 1 (muy difícil) a 5 (muy fácil)
Q6_ESCALA = {"Muy difícil": 1, "Difícil": 2, "Ni fácil ni difícil": 3, "Fácil": 4, "Muy fácil": 5}
Q8_VALIDOS = {"Sí": 1, "No": 0}
Q9_ATRIBUTOS = {
    "Q9_1": "Profesionalismo y conocimiento",
    "Q9_2": "Amabilidad y cercanía",
    "Q9_3": "Claridad en las instrucciones",
    "Q9_4": "Tiempo de atención",
}
EMOCIONES = ["Enojado", "Decepcionado", "Molesto", "Frustrado", "Ninguna", "Tranquilo", "Confiado", "Satisfecho", "Feliz"]

# Filas con el formato alterno traen DIVISION como código. Equivalencia deducida por la ciudad
# (oct-2026: 1 = Bucaramanga/Villavicencio/Tunja, 4 = Bogotá, 5 = Cali, 6 = Medellín/Pereira, 8 = Barranquilla).
DIVISION_CODIGO = {"1": "Oriente", "4": "Centro", "5": "Occidente", "6": "Noroccidente", "8": "Costa"}
REGIONES = ["Centro", "Costa", "Noroccidente", "Occidente", "Oriente"]
TIPO_RED = {"BIDIRECCIONAL": "HFC", "FTT": "FTTH", "FTTH": "FTTH", "DTH": "DTH"}

# Sufijos societarios que parten un mismo aliado en dos («CINCO» y «CINCO S.A.S.»)
SUFIJOS_ALIADO = r"\b(S\.?\s?A\.?\s?S\.?|S\.?\s?A\.?|LTDA\.?)\s*$"

SIN_DATO = "Sin dato"
N_MINIMO = 30                 # cortes con menos encuestas se marcan «muestra baja» en el tablero
VARIACION_N_AVISO = 0.40      # aviso si el n del mes cambia más de ±40 % frente al anterior
MAX_VERBATIMS_PERIODO = 6000  # tope de comentarios por mes en la salida

# Preguntas abiertas que se muestran como verbatim (texto de la encuesta)
ABIERTAS = {
    "Q3": "Comentario (experiencia no satisfactoria)",
    "Q13": "Motivo de la calificación",
    "Q4": "Comentario (experiencia positiva)",
    "Q7": "Qué fue difícil al contactar",
    "Q10": "Cómo mejorar la atención del asesor",
}
