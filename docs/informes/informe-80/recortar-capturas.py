"""
Recorta las capturas del informe para que muestren solo lo que importa.

Las capturas salen de la ventana completa (1440x900) y repiten en cada figura la barra lateral
y la cabecera. Este script deja el área de contenido y, en las que abren un formulario, solo la
ventana emergente.

Uso:  python docs/informes/informe-80/recortar-capturas.py
Es idempotente: una imagen que ya no mide 1440 de ancho se deja como está.
"""
from pathlib import Path

from PIL import Image, ImageDraw

CAPS = Path(__file__).resolve().parent / "capturas"

# Bordes medidos sobre una captura: la barra lateral termina en 228, la cabecera en 48 y la
# barra de desplazamiento empieza en 1429.
IZQUIERDA = 229
ARRIBA = 49
DERECHA = 1428

# Las que abren una ventana emergente se recortan a esa ventana, no al área de contenido.
# «Agregar persona» lleva su contorno a mano: la tabla que queda detrás es casi igual de
# blanca que la ventana y la detección automática se la lleva puesta.
EMERGENTES = {"18-nuevo-insumo"}
A_MANO = {"14-agregar-persona": (380, 235, 1046, 665), "22-cambio-de-rol": (387, 138, 1052, 762), "23-login-ver-clave": (862, 185, 1332, 715)}

# Las del tutorial necesitan ver la pantalla detrás, así que solo se les quita la barra lateral.
MARGEN_EMERGENTE = 14


def recorte_del_contenido(im):
    """Área de contenido, sin la barra lateral ni la cabecera, y sin el blanco sobrante abajo."""
    caja = im.crop((IZQUIERDA, ARRIBA, DERECHA, im.height))
    px = caja.load()

    # Última fila con algo escrito o dibujado: todo lo de abajo es relleno vacío de la tarjeta.
    ultima = caja.height
    for y in range(caja.height - 1, 0, -1):
        if any(sum(px[x, y]) < 570 for x in range(0, caja.width, 3)):
            ultima = min(caja.height, y + 28)
            break

    return caja.crop((0, 0, caja.width, ultima))


def recorte_de_la_emergente(im):
    """La ventana emergente es lo blanco sobre el fondo oscurecido: se busca su contorno."""
    px = im.load()
    x0, y0, x1, y1 = im.width, im.height, 0, 0

    for y in range(0, im.height, 2):
        for x in range(0, im.width, 2):
            r, g, b = px[x, y]
            if r >= 250 and g >= 250 and b >= 250:
                x0, y0 = min(x0, x), min(y0, y)
                x1, y1 = max(x1, x), max(y1, y)

    if x1 <= x0 or y1 <= y0:
        return recorte_del_contenido(im)

    m = MARGEN_EMERGENTE
    return im.crop((max(0, x0 - m), max(0, y0 - m), min(im.width, x1 + m), min(im.height, y1 + m)))


# Correos de personas reales que aparecen en «Personal y usuarios»: se tapan antes de que la
# captura entre al informe. Las cajas están en coordenadas de la imagen ya recortada.
CORREOS_A_TAPAR = {
    "09-usuarios": [(33, 553, 245, 569), (33, 601, 245, 617), (33, 649, 245, 665), (33, 697, 245, 713)],
    "21-perfil": [(33, 145, 450, 165)],
}


def tapar_correos(im, nombre):
    d = ImageDraw.Draw(im)
    for caja in CORREOS_A_TAPAR[nombre]:
        d.rectangle(caja, fill=(214, 214, 214))
    return im


def main():
    for ruta in sorted(CAPS.glob("*.png")):
        im = Image.open(ruta).convert("RGB")
        if im.width != 1440:
            print(f"  {ruta.name}: ya recortada ({im.width}x{im.height})")
            continue

        if ruta.stem in A_MANO:
            nueva = im.crop(A_MANO[ruta.stem])
        elif ruta.stem in EMERGENTES:
            nueva = recorte_de_la_emergente(im)
        else:
            nueva = recorte_del_contenido(im)

        if ruta.stem in CORREOS_A_TAPAR:
            nueva = tapar_correos(nueva, ruta.stem)

        nueva.save(ruta)
        print(f"  {ruta.name}: {im.width}x{im.height} -> {nueva.width}x{nueva.height}")


if __name__ == "__main__":
    main()
