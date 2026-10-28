"""
Word baja la resolución de las imágenes al exportar a PDF (~220 ppp), aunque el .docx tenga los originales.
Este script toma el PDF exportado y cambia cada imagen por la original del .docx, en su resolución completa.

Uso:  python restaurar_resolucion.py <documento.docx> <documento.pdf>
Requiere: pikepdf y Pillow.
"""
import io
import re
import sys
import zipfile
import zlib

import pikepdf
from PIL import Image


def imagenes_del_docx(ruta_docx):
    """Imágenes en el orden en que aparecen en el documento (bytes originales)."""
    with zipfile.ZipFile(ruta_docx) as z:
        rels = z.read('word/_rels/document.xml.rels').decode('utf-8')
        destino = dict(re.findall(r'Id="(rId\w+)"[^>]*Target="([^"]+)"', rels))
        documento = z.read('word/document.xml').decode('utf-8')
        orden = re.findall(r'r:embed="(rId\w+)"', documento)
        return [z.read('word/' + destino[rid]) for rid in orden]


def proporcion(w, h):
    return w / h


def reemplazar(pdf, obj, original):
    im = Image.open(io.BytesIO(original))
    if im.format == 'JPEG':
        obj.write(original, filter=pikepdf.Name.DCTDecode)
        espacio = pikepdf.Name.DeviceGray if im.mode == 'L' else pikepdf.Name.DeviceRGB
    else:
        if im.mode in ('RGBA', 'LA', 'P'):
            fondo = Image.new('RGB', im.size, 'white')
            im = im.convert('RGBA')
            fondo.paste(im, mask=im.split()[-1])
            im = fondo
        im = im.convert('RGB')
        obj.write(zlib.compress(im.tobytes(), 9), filter=pikepdf.Name.FlateDecode)
        espacio = pikepdf.Name.DeviceRGB
    for clave in ('/DecodeParms', '/SMask', '/Mask', '/Decode'):
        if clave in obj:
            del obj[clave]
    obj.Width, obj.Height = im.size
    obj.ColorSpace = espacio
    obj.BitsPerComponent = 8


def main(ruta_docx, ruta_pdf):
    originales = []
    for data in imagenes_del_docx(ruta_docx):
        im = Image.open(io.BytesIO(data))
        originales.append((data, im.size))

    pdf = pikepdf.open(ruta_pdf, allow_overwriting_input=True)
    usado = [False] * len(originales)
    puntero = 0
    cambiadas = 0
    for pagina in pdf.pages:
        for _nombre, obj in pagina.images.items():
            w, h = int(obj.Width), int(obj.Height)
            # La imagen original es la siguiente sin usar con la misma proporción (Word conserva el orden).
            for k in range(puntero, min(puntero + 8, len(originales))):
                ow, oh = originales[k][1]
                if not usado[k] and abs(proporcion(ow, oh) - proporcion(w, h)) / proporcion(ow, oh) < 0.02:
                    if ow > w:
                        reemplazar(pdf, obj, originales[k][0])
                        cambiadas += 1
                    usado[k] = True
                    while puntero < len(usado) and usado[puntero]:
                        puntero += 1
                    break
    pdf.save(ruta_pdf)
    print(f'{cambiadas} imágenes restauradas a su resolución original ({sum(usado)} de {len(originales)} reconocidas)')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
