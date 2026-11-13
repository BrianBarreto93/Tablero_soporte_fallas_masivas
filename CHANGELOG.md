# Cambios

## 2026-11-13 · v4

- Junto al n de CES, Funcionando y Asesor va la correlación con el NPS (Pearson, encuesta por encuesta), en verde (fuerte),
  amarillo (moderada) o rojo (baja); la explicación sale al pasar el cursor. En octubre: CES 0,69, Funcionando 0,71, Asesor 0,73.
- El filtro de mes pasa a casillas: uno o varios meses, con atajos «Solo el último» y «Todos». La URL guarda la selección.
- Lo mismo que se hizo en el tablero de Factura, pago y cobro.

## 2026-11-11 · v3

- Caja «Dolores del cliente» en Resumen: 9 dolores con la taxonomía de los análisis de suficiencia de Soporte y Fallas masivas,
  NPS y CES con y sin cada dolor, y puntos de NPS recuperables en teoría. Mes o año corrido; responde a todos los filtros.
- `etl/dolores.py` y conteos por dolor en el cubo (tabla dispersa `dolores` en `datos.js`). Ene–ago cuadra con los decks.
- Botón «Descargar base» (Excel, CSV o Parquet) según los filtros.

## 2026-11-11 · v2

- Histórico ene–sep 2026 (15.794 encuestas) cargado en Oracle desde los exportes de Qualtrics (`etl/cargar_historico.py`); 1 comentario recortado a 4000 bytes.
- Periodo = mes de RECORDEDDATE. La serie CES Soporte ene–sep y Falla masiva may–sep cuadra exacto con el Power BI (prueba automática).
- Rediseño: ocupa toda la ventana (lienzo 1000 × 800 de Tableau), riel lateral, tema oscuro/claro, KPI con tendencia de 10 meses,
  carrusel «Lo que dicen los clientes» y panel lateral por indicador con comentarios de ambos lados.
- Comentarios en `comentarios.js` con carga diferida; muestreo aleatorio fijo si un mes pasa de 6.000.

## 2026-11-11 · v1

- ETL Oracle → cubo de conteos con contrato de calidad (errores bloquean, avisos visibles) y escaneo de datos personales.
- Tablero con 6 pestañas (Resumen, Facilidad, Resolución, Asesor, Voz del cliente, Calidad de datos), filtros en la URL,
  clic en rankings para filtrar, IC 95 % y marca de muestra baja.
- Primer corte: octubre 2026 (793 encuestas). Soporte NPS −22,9 · CES 42,2 % · funcionando 47,9 %;
  Falla masiva NPS −38,1 · CES 34,2 % · funcionando 54,0 %.
