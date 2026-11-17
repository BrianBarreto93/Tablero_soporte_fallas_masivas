# Tablero Soporte y Fallas masivas

Tablero HTML estático de la encuesta de experiencia de **Soporte** y **Falla masiva** Hogar (Qualtrics).
Fuente: Oracle `INVITADO_15.TBL_ENC_SOPORTE_FALLAS` (solo lectura). La clasificación de red propia/neutra de la base
descargable sale de Yellowbrick (`VW_CLIEN_SERVICIOS_FTTH`, credenciales del `.env` de `claro_CR_Recurrencia`).

- Publicado: https://servidor.lan.qwertylab.dev/umm/SOPORTE-FM/Soporte_FM.html
- Abrir local: `tablero/Soporte_FM.html` (funciona con doble clic, sin servidor ni internet).

## Corrida mensual

```bash
cd /opt/apps/claro_tablero_focos/claro_tablero_sop_fm
.venv/bin/python -m etl.construir          # Oracle → data/periodos/AAAAMM.json → tablero/datos.js
.venv/bin/python -m pytest -q              # limpieza, contrato de calidad, cifras de referencia
.venv/bin/python -m etl.publicar           # SFTP LAN + verificación HTTP
```

- `--periodo 202611` procesa un solo mes. `--solo-ensamblar` rehace `datos.js` con lo ya guardado, sin ir a Oracle.
- Oracle tiene ene–oct 2026: octubre lo cargó el proceso de origen (2026-11-09) y ene–sep se cargaron el 2026-11-11 desde los
  exportes de Qualtrics con `etl/cargar_historico.py` (lote `FECHA_CARGA = 2026-11-11 14:06:55`; el DELETE para revertir está en
  `data/cargas/`). Si el proceso de origen vacía la tabla en un corte futuro, **el histórico sigue en `data/periodos/`**: no borrar esa carpeta.
  Cada corrida reemplaza solo los meses que encuentra en Oracle.
- Si un chequeo de calidad da **error**, la corrida se detiene y no escribe nada. `etl.publicar` tampoco sube si hay errores.

## Cómo está hecho

| Paso | Archivo | Qué hace |
|---|---|---|
| Extraer | `etl/extraer.py` | `SELECT` con lista blanca de columnas (`etl/config.py`). Nunca `SELECT *`. Cuentas repetidas se cuentan en SQL. |
| Limpiar | `etl/limpiar.py` | Quita emojis de las opciones, Q6 → escala 1–5, código de división → región, red con fecha → «Sin dato», unifica aliados (S.A.S., LTDA), reasigna la analítica de texto de Qualtrics. |
| Calidad | `etl/calidad.py` | Contrato de datos: errores que bloquean y avisos que se muestran en la pestaña *Calidad de datos*. |
| Dolores | `etl/dolores.py` | Marca 9 dolores por encuesta con las reglas de los decks de dolores (`claro_analisis_umm/Soporte y fallas/analisis_dolores.py`, copiadas sin cambios). «La falla sigue» suma Q8 = No. |
| Comentarios | `etl/verbatims.py` | Tapa correos, cifras de 5+ dígitos, nombre del encuestado y nombres tras «técnico», «asesor», «señor»… |
| Agregar | `etl/agregar.py` | Cubo de **conteos sumables** (no porcentajes) por periodo × semana × estudio × región × red × marcación × aliado × operación × estrato. |
| Tablero | `tablero/app.js` | Suma las filas que pasan los filtros y calcula los indicadores: cualquier combinación da el valor ponderado correcto. |
| Red | `etl/red.py` | Clasificación de red para la base: HFC, FTTH propia, FTTH neutra o DTH. HFC/FTTH/DTH = la red de la encuesta; propia o neutra por cuenta en Yellowbrick y, si no está, por nodo (cada nodo es 100 % propio o neutro). Sin Yellowbrick la corrida sigue y avisa en Calidad. |
| Base | `etl/base.py` → `tablero/base/AAAAMM.js` | Una fila por encuesta con clasificación de red y `categoría_dolor` (los dolores de la encuesta, separados por «\|»). El botón «Descargar base» la filtra con los filtros activos (mes elegido o todos) y la baja en Excel, CSV o Parquet con `tablero/exportar.js` (copia del de CR). |
| Contacto | `etl/base.py` → `tablero/contacto/AAAAMM.js` | Cuenta, teléfono (sin el 57) y correo por ID de respuesta. **Fuera de git** (`.gitignore`): solo existe en el servidor y en esta carpeta. El tablero los pega después del ID al descargar; si falta el archivo, salen vacíos. |
| Comentarios | `tablero/comentarios.js` | Va aparte (≈ 2,7 MB) y se carga después de pintar. Ejemplos por indicador: detractores/promotores, difícil/fácil, no funciona/funciona, asesor mal/bien evaluado. |

### Diseño

Mismo esquema de tamaño que los tableros CR y recurrencia (`claro_CR_Recurrencia`): la página ocupa todo el ancho, crece con su
contenido y se desplaza; textos en px fijos (13 px base) y el banner y las cifras grandes escalan con el ancho (`clamp(…vw…)`).
Cortes en 1300 px (KPI de a dos, paneles en una columna, sin sello) y 760 px (celular, menú abajo). El banner de Claro va siempre
arriba; el menú lateral y la barra de filtros quedan fijos al desplazar. Modo claro por defecto y oscuro con el botón de la barra.

### Definiciones

- **NPS** = % promotores (9–10) − % detractores (0–6) de Q2. En puntos.
- **CES** = (Fácil + Muy fácil) / respuestas válidas de Q6. Más alto = mejor.
- **Servicio funcionando** = Q8 «Sí» / (Sí + No).
- **Desempeño del asesor** = % de calificaciones 4–5 en los cuatro atributos de Q9 (sin confirmar con negocio).
- **Dolores** (caja en Resumen): % de encuestas que menciona el dolor, NPS y CES con y sin él, y los puntos de NPS que se
  recuperarían en teoría = % con el dolor × (NPS sin − NPS con). Es decir, el NPS pasaría a ser el de quienes no lo viven.
  Los dolores se cruzan, así que los puntos no se suman; el techo de arriba usa las encuestas sin ningún dolor.
  Ene–ago cuadra con los decks de dolores de Suficiencia Soporte y Suficiencia Fallas Masivas (prueba automática).
- **Alarmas** (Resumen, reemplaza «Soporte vs Falla masiva»): por estudio (el del filtro o los dos), con los meses y filtros
  actuales. Solo cuenta lo que sale del margen de error al 95 % de las dos cifras (√(ic₁² + ic₂²)). *Crítica*: el indicador
  o un segmento (región, red, aliado, marcación, operación; n ≥ 30 en ambos periodos) cae frente al periodo anterior.
  *A vigilar*: el valor más bajo de la serie (≥ 6 meses) o tres meses seguidos bajando (con un solo mes elegido), un segmento
  por debajo del total del estudio, o un dolor que sube. *Mejora*: el indicador sube. Segmentos y dolores: los 3 de más peso
  por estudio. «Filtrar» aplica ese segmento a todo el tablero. Si el mes elegido es el del corte, se avisa que está en curso.
- **Correlación con el NPS** (valor junto al n de CES, Funcionando y Asesor): Pearson entre la nota del indicador y Q2 (0–10),
  encuesta por encuesta, con los filtros actuales. CES = Q6 (1–5), Funcionando = Q8 (sí/no), Asesor = suma de los 4 atributos de Q9
  (solo quien calificó los 4). Verde ≥ 0,50, amarillo 0,30–0,49, rojo < 0,30; no se calcula con menos de 30 pares.
- **Varios meses**: el filtro de mes tiene casillas. Con varios meses las cifras suman todas sus encuestas y se comparan con los
  mismos N meses justo antes (si la selección es continua). La URL guarda `periodo=AAAAMM|AAAAMM`.
- Periodo = mes de `RECORDEDDATE` (coincide 100 % con los exportes oficiales; con él la serie CES cuadra exacto con el Power BI). Unidad = encuesta (`RESPONSEID`). Muestra baja = n < 30.

### Trampas conocidas de la fuente (oct-2026)

1. 224 filas (28 %) con formato alterno: `DIVISION` en código (1 Oriente, 4 Centro, 5 Occidente, 6 Noroccidente, 8 Costa),
   `ZONA` en código y `TIPO_RED` con una fecha. La región se reconstruye; la red queda «Sin dato».
2. La analítica de texto está corrida: `Q4_*` son los temas de Q7 y `Q7_*` los de Q10. Se detecta sola por coincidencia de filas.
3. 84 encuestas sin terminar: tienen Q2 y Q6, no Q8 ni Q9.
4. Todo es `VARCHAR2` con emojis y saltos de línea en las opciones.
