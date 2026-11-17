"""Dolores del cliente por encuesta, con la taxonomía de los análisis de suficiencia
(/opt/apps/claro_analisis_umm/Soporte y fallas/analisis_dolores.py, que alimenta los decks de dolores de
«Suficiencia Soporte» y «Suficiencia Fallas Masivas»). Las expresiones se copian sin cambios: si el análisis
las ajusta, hay que copiarlas de nuevo aquí.

Un dolor se marca si aparece en cualquiera de los comentarios Q3, Q13, Q7 o Q10 (Q4 es el elogio de los
promotores). «persiste» además incluye a quien responde Q8 = No, igual que la tarjeta E5 del deck.
"""
import re
import unicodedata

import pandas as pd

from etl.limpiar import texto_opcion

TEXTOS = ["Q3", "Q13", "Q7", "Q10"]

# clave: (momento del recorrido, regex sobre texto en minúscula y sin tildes)
REGLAS = {
    'aviso': ('Antes', r'aviso|avisar|avisaron|previo|informa(r|cion|ron|n|cion)|informe|no (nos |me )?(dicen|dijeron|saben|sabian|explicaron) (cuando|cual|que paso|el tiempo|la hora|nada|el motivo)|tiempo (de solucion|estimado|de respuesta)|cuanto (tiempo|tarda|demora)|cuando (se )?(restablec|vuelve|soluciona)|hora de (solucion|restabl)|notific|comunicado|fallas? en (el|la) (sector|zona)|falla (masiva|general)|mantenimiento|actividad programada|actualizacion|migra|explicar la situacion'),
    'contacto': ('Antes', r'ivr|conmutador|menu|opciones|numeral|grabacion|robot|\bbots?\b|maquina|contest|no atiend|no (me )?(han )?atendido|no responden|comunicar(me|se|nos)? con|contactar|hablar con (un|una|alguien)|lograr (el )?(contacto|comunic)|(dificil|imposible|complicado)[^|]{0,15}comunic|forma de comunicar|acceso a (las llamadas|un asesor)|no hay asesores|en espera|esperar|espera (de|larga|muy)|tiempo de espera|\d+ ?(min|minutos)\b|colg|cuelga|se (cae|cayo|corta|corto|cortaba) la (llamada|comunicacion)|cort(o|aba|aban|an|aron) la (llamada|comunicacion)|la llamada (se|no)|\bchat\b|whats|wasap|wpp|wapp|watsap|centro de atencion|oficina|punto fisico'),
    'asesor': ('Durante', r'de un lado (a|para|al) otro|de asesor en asesor|de area en area|de persona a persona|pelote|lo pasean|nos pasean|transfier|remit|repetir|volver a explicar|explicar (lo mismo|otra vez)|cada vez que (se )?llam|varias (veces|llamadas)|muchas (veces|llamadas)|todos los dias llam|apag(ar|ue|a|o) y (prend|encend)|reinici|desconect(ar|e|o) y (conect|volv)|no (saben|sabia|sabe|sabian)\b|no tienen idea|no dan razon|automata|guion|siempre (dicen|lo mismo|la misma)|dicen lo mismo|cosas diferentes|evasiv|conocimiento|capacit|no (pudieron|pueden|supo|supieron) (identificar|solucionar|resolver)|no escal|grosero|mala gana|irrespetu|no escuch|empatia|mala atencion|pesima atencion|no le importa'),
    'visita': ('Durante', r'(no|nunca|ni siquiera) (\w+ )?(llego|llegaron|vino|vinieron|fue nadie|aparecio|se present|asistio|ha venido|han venido|realizaron|hicieron la visita|hubo visita)|(tecnico|visita|cita)[^|]{0,40}(no (llego|vino|se present|cumpl|se realiz|fue|asist)|nunca|incumpl|cancel|reprogram)|(no|nunca|sin|dificil|lograr|solicit|pedi|programar|agend|generar)[^|]{0,25}(visita|cita)|esperando (al |el |la |un |a )?(tecnico|visita)|(tecnico|tecnicos)[^|]{0,80}(no (soluciono|arreglo|resolvio|hizo|reparo|sirvio)|se fue|no traia|no tenia|limpio)|falla externa|red externa|dano externo|(es|era) externo|parte externa|poste'),
    'tiempo': ('Durante', r'(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|varios|muchos|mas de \w+) (dias|semana|semanas|mes|meses)|todo el dia|toda la noche|fin de semana|\d+ ?(horas|hrs)|desde (el|hace|ayer|anoche|ese)|demor|tard(o|aron|anza|an|a mucho)|mucho tiempo|rapid|agil|oportun|pronto'),
    'promesa': ('Durante', r'promet|dijeron que (en|iba|ib|seria|a las|ya|maximo|quedaba)|iban a|quedaron (en|de)|en \d+ horas|ilimitad|recarga|incumpl|no cumpl|nunca cumpl|cumplan|mentir|mienten|mentira|\bengan|falta de respeto|seri(o|os|edad)'),
    'persiste': ('Después', r'(sigue|sigo|continua|continuo|persiste|perciste|seguimos|aun|todavia|se sigue)[^|]{0,30}(fall|sin|problema|igual|mism|intermit|mal|dan|se cae|presentando|molestando|cayendo)|(falla|problema|dano|error|inconveniente) (sigue|continua|persiste)|no (me )?(han|ha|a|hubo|hay|dieron|dan|brindaron|pudieron|se)? ?(sido )?(solucion|arregl|resolv|resuel|repar|silucion|salicion)|sin solucion|nada que|no quedo (funcionando|funcional|bien)|nunca (me )?(han )?(dieron )?(solucion|arregl|resolv)|ninguna solucion|a medias|solucion definitiva|no (tengo|tenemos) (servicio|internet|senal|tv|television|wifi)|sin (servicio|internet|senal|tv|television)|no sirve|no funciona|cerra(ron|do) (el|la) (caso|incidente|ticket|solicitud)|dieron por (solucionad|cerrad)|declar'),
    'recurrente': ('Después', r'intermiten|se cae|se cay|cayendo|se va el|se va la|se fue (el|la)|\blent|pausad|pixel|congel|inestable|cada rato|a cada momento|constante|todos los dias|cada mes|repetitiv|varias ocasiones|otra vez|de nuevo|nuevamente|volv(io|e) a (fallar|danar|caer|pasar|presentar)|se volvio a|mala (la )?senal|pesima (la )?senal|senal (es )?(regular|mala|deficiente)|no carga|deficiente'),
    'cobro': ('Después', r'cobr|factur|pag(o|ar|ando) (por|un|el|toda|completo|igual)|descuent|compens|ajuste|reconoc|devolu|reembols|reintegr|no prestaron|abono|nota credito'),
}
CLAVES = list(REGLAS)
# Nombre corto de cada dolor para la columna categoría_dolor de la base (mismo sentido que los títulos del tablero)
NOMBRES = {
    'aviso': 'Sin aviso ni hora de solución', 'contacto': 'Difícil llegar a un asesor', 'asesor': 'El asesor no resuelve',
    'visita': 'Técnico no llega o no resuelve', 'tiempo': 'Días sin solución', 'promesa': 'Promesa incumplida',
    'persiste': 'La falla sigue', 'recurrente': 'La falla vuelve', 'cobro': 'Cobro sin servicio',
}
SIN_DOLOR = "Sin dolor identificado"
_RX = {k: re.compile(v) for k, (_, v) in REGLAS.items()}


def _norm(s):
    s = unicodedata.normalize("NFKD", str(s).lower())
    return re.sub(r"\s+", " ", "".join(ch for ch in s if not unicodedata.combining(ch)))


def marcar(crudo, d):
    """DataFrame booleano (índice de d) con una columna por dolor y «alguno»."""
    txt = pd.Series("", index=d.index)
    for q in TEXTOS:
        t = crudo.loc[d.index, q].map(texto_opcion)
        txt = txt.str.cat(t.map(lambda x: _norm(x) if x else ""), sep=" || ")
    m = pd.DataFrame({k: txt.map(lambda t, rx=rx: bool(rx.search(t))) for k, rx in _RX.items()}, index=d.index)
    m["persiste"] |= d.q8.eq(0)
    m["alguno"] = m[CLAVES].any(axis=1)
    return m


def categoria(m):
    """Texto con los dolores de cada encuesta, separados por « | » (orden del recorrido: antes, durante, después)."""
    return m[CLAVES].apply(lambda f: " | ".join(NOMBRES[k] for k in CLAVES if f[k]) or SIN_DOLOR, axis=1)
