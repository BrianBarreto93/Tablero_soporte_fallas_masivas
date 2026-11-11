"""Sube el tablero al host estático por SFTP LAN (mismo mecanismo que claro_CR_Recurrencia/etl/publicar_tablero.py).

Uso: .venv/bin/python -m etl.publicar     (después de etl.construir)
URL: https://servidor.lan.qwertylab.dev/umm/SOPORTE-FM/Soporte_FM.html
"""
import json
import urllib.request
import ssl

import paramiko
from dotenv import dotenv_values

from etl.config import RAIZ

ORIGEN = RAIZ / "tablero"
BASE = "/incoming/compartido/proyectos_HTML/estaticos/UMM/SOPORTE-FM"
URL = "https://servidor.lan.qwertylab.dev/umm/SOPORTE-FM/Soporte_FM.html"
# Credenciales SFTP prestadas del .env de claro_vista_360 (igual que el tablero CR)
ENV = dotenv_values("/opt/apps/claro_vista_360/.env")


def _sin_errores():
    """No publica si el último datos.js trae algún chequeo de calidad en «error»."""
    js = (ORIGEN / "datos.js").read_text(encoding="utf-8")
    datos = json.loads(js[len("window.DATOS="):].rstrip().rstrip(";"))
    malos = [c["titulo"] for p in datos["periodos"].values() for c in p["calidad"] if c["nivel"] == "error"]
    if malos:
        raise SystemExit(f"No se publica: chequeos en error {malos}")


def main():
    _sin_errores()
    archivos = [p for p in ORIGEN.rglob("*") if p.is_file()]
    t = paramiko.Transport((ENV["SFTP_HOST_LAN"], int(ENV["SFTP_PORT_LAN"])))
    t.connect(username=ENV["SFTP_USER_LAN"], password=ENV["SFTP_PASS_LAN"])
    s = paramiko.SFTPClient.from_transport(t)
    for d in sorted({BASE} | {f"{BASE}/{p.parent.relative_to(ORIGEN).as_posix()}" for p in archivos if p.parent != ORIGEN}):
        try:
            s.stat(d)
        except IOError:
            s.mkdir(d)
    for p in archivos:
        r = f"{BASE}/{p.relative_to(ORIGEN).as_posix()}"
        s.put(str(p), r)
        assert s.stat(r).st_size == p.stat().st_size, r
    s.close(); t.close()
    ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    cod = urllib.request.urlopen(URL, context=ctx, timeout=20).status
    print(f"{len(archivos)} archivos subidos → {URL} (HTTP {cod})")


if __name__ == "__main__":
    main()
