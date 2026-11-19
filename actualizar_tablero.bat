@echo off
rem ============================================================
rem  Actualiza y publica el tablero Soporte y Falla masiva
rem   1. Oracle -> data\periodos -> tablero\datos.js   (etl.construir)
rem   2. Pruebas (limpieza, contrato de calidad, cifras de referencia)
rem   3. Publicacion por SFTP LAN + verificacion HTTP  (etl.publicar)
rem  Lo llama "D:\Proyectos\1. descargar_enc_fm_sop\run_etl.bat" despues de cargar Oracle.
rem  Tambien sirve solo: doble clic. Detalle en logs\tablero_AAAAMMDD_HHMM.log
rem  Codigo de salida: 0 = publicado, 1 = fallo (no se publica lo que falto).
rem ============================================================
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "PYTHONIOENCODING=utf-8"
set "PYTHONUTF8=1"
set "PY=.venv\Scripts\python.exe"
if not exist logs mkdir logs
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmm"') do set "TS=%%i"
set "LOG=%~dp0logs\tablero_%TS%.log"

echo.
echo  =============================================================================
echo   TABLERO SOPORTE Y FALLA MASIVA  ^|  %date% %time:~0,5%
echo  =============================================================================
if not exist "%PY%" (
    echo  [X] No existe el entorno virtual. Crear con:
    echo      python -m venv .venv ^&^& .venv\Scripts\pip install -r requirements.txt
    exit /b 1
)
if not exist ".env" (
    echo  [X] Falta el archivo .env con las credenciales. Ver .env.example
    exit /b 1
)

echo   [1/3] Construyendo el tablero desde Oracle...
"%PY%" -u -m etl.construir >> "%LOG%" 2>&1 || goto :fallo
echo   [2/3] Pruebas...
"%PY%" -m pytest -q >> "%LOG%" 2>&1 || goto :fallo
echo   [3/3] Publicando por SFTP...
"%PY%" -u -m etl.publicar >> "%LOG%" 2>&1 || goto :fallo

powershell -NoProfile -Command "Get-Content -LiteralPath '%LOG%' -Tail 1 -Encoding UTF8"
echo   RESULTADO TABLERO: OK. Log: %LOG%
exit /b 0

:fallo
echo   RESULTADO TABLERO: CON ERRORES. No se publico. Ultimas lineas del log:
echo  -----------------------------------------------------------------------------
powershell -NoProfile -Command "Get-Content -LiteralPath '%LOG%' -Tail 15 -Encoding UTF8"
echo  -----------------------------------------------------------------------------
exit /b 1
