# Cambios

## 2026-11-18 · v8.1

- Filtros de la barra de arriba con la selección resaltada, como los filtros de Voces: cada grupo es una cápsula con su
  nombre sobre el borde (Mes, Estudio/Segmento/Proceso/Negocio); la opción elegida se rellena con su color y, si el grupo
  filtra algo (no «Todos»), el borde y el nombre toman ese color y la cápsula brilla; al cambiar, late una vez. Los filtros
  de lista (+ Región…) con algo elegido pasan a cápsula roja con el nombre arriba y solo el valor adentro.
- Menú de vistas que se esconde: en pantalla ancha flota como una cápsula de vidrio (el contenido usa todo el ancho) y,
  si no se usa, se disuelve en un asa delgada con un punto por vista (la activa, alargada en rojo). Vuelve con un resorte
  al acercar el cursor al borde izquierdo, al pasar por el asa o con el teclado; los íconos entran en cascada, crecen
  como en un dock según la cercanía del cursor y una luz roja sigue a la vista activa. En el celular, la barra de abajo
  se esconde al bajar y vuelve al subir o al tocar el asa.
- Todo en `tablero/navegacion.js` + `navegacion.css` (misma copia en Factura, Soporte-FM y Digital): decora lo que pinta
  app.js, sin cambiar su lógica.

## 2026-11-18 · v8

- Dolores del cliente: clic en un dolor para **resaltarlo** (los demás se apagan y en el recuadro de arriba aparece hasta
  dónde llegaría el NPS sin ese dolor). El **globo** junto a cada dolor abre «Lo que más repiten»: las palabras más
  frecuentes y los comentarios agrupados (los casi iguales juntos, con ×n), con los filtros y el periodo de la caja.
- Encabezado de la lista: el indicador en grande y debajo la clave (con el dolor, sin el dolor, total), todo centrado;
  «NPS que recupera» también centrado.
- `comentarios.js` trae la columna `dl` (máscara de dolores de cada comentario, `etl/dolores.py::marcar_comentario`) y
  `dl_claves`. Se rehízo con `--solo-ensamblar` (sin Oracle): las cifras no cambian.
- Gráficos de líneas nuevos (`GRAF.lineas` en `graficos.js`, la misma copia en Factura, Soporte-FM y Digital): curva suave
  que no inventa picos entre meses, área en degradado y resplandor del color de la serie. Al entrar en pantalla la línea se
  traza con un cometa, cada punto aparece cuando la línea llega a él y la cifra final, en píldora, cuenta hasta su valor; el
  último punto late unos segundos. Mes elegido en píldora oscura. Redibujar con los mismos datos (tamaño, tema) no repite la
  animación; al imprimir o con «reducir movimiento» se ve quieto.
- Sparks de los KPI con curva suave, más color en el área y un punto final que late.

## 2026-11-17 · v6.1

- Alarmas: nueva regla de **cantidad de encuestas**. Más o menos de ±25 % frente al promedio mensual histórico es alerta
  (crítica si hay 50 % o más de menos); el mes en curso se proyecta al mes completo. Responde a los filtros.

## 2026-11-17 · v6

- Base descargable con **cuenta, teléfono y correo** (después del ID), **Clasificación de red** (HFC, FTTH propia,
  FTTH neutra, DTH; `etl/red.py` con Yellowbrick) y **categoría_dolor** (los 9 dolores del tablero, separados por «|»;
  «Sin dolor identificado» si no hay). Los datos de contacto van en `tablero/contacto/` (fuera de git).
- Resumen: la caja «Soporte vs Falla masiva» pasa a **Alarmas** de NPS, CES, Funcionando y Asesor, según los filtros
  (caídas y mejoras fuera del margen de error, rachas, mínimos, segmentos que caen o quedan bajo el total, dolores que suben).
- Datos hasta el 17-nov-2026 (noviembre parcial, 568 encuestas). Octubre se recargó en Oracle el 17-nov sin cambios.
- Incluye la nube de comentarios de Voces (`nube.js/css`) y la brecha en barras, que estaban sin commit.

## 2026-11-13 · v5

- Gráficos animados con Motion (`tablero/vendor/motion.js`, copia local: funciona sin internet). La librería
  `tablero/graficos.js` + `graficos.css` es la misma en los tableros Factura y Soporte-FM; si se cambia una copia, copiar a la otra.
- Escala evaluativa de 9 tonos: rojo intenso (lo peor) → verde sobrio (lo mejor), en claro y oscuro. Los colores de serie
  (Soporte/Falla masiva) no cambian. Los tonos intermedios van en rosa/coral para no confundirse con el naranja de serie.
- Más variedad: anillo en cada KPI, cifras que cuentan, tendencias de área, barras divergentes 1–5 que crecen desde el centro,
  cuadrícula de 100 cuadritos para el NPS, donas sí/no, columnas apiladas, motivos como paletas, relojes, brecha en columnas
  y rankings coloreados según la diferencia contra el total.
- Cada panel se anima al entrar en pantalla; al imprimir, con «reducir movimiento» o sin motion.js todo se ve en su estado final.
- Ninguna cifra cambia: se comprobaron todos los números de tooltips y textos contra la versión anterior.

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
