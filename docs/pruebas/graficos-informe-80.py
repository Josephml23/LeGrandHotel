"""
Gráficos del informe de la entrega del 80% (PNG en escala de grises, legibles impresos).

Cubre las dos últimas pruebas hechas dentro de la red de Docker:
  B. 100 clientes registrando 5000 reservas  (y la comparación con las 1000)
  C. 5000 usuarios entrando en bloques de 100 en un minuto

Uso:  python docs/pruebas/graficos-informe-80.py
Requiere: matplotlib
"""
import io
import json
import re
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

BASE = Path(__file__).resolve().parent
DATA = BASE / "datos"
OUT = BASE / "graficos"
OUT.mkdir(exist_ok=True)

INK = "#111111"
MID = "#666666"
LIGHT = "#bbbbbb"

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 10,
    "axes.edgecolor": MID,
    "axes.labelcolor": INK,
    "axes.titleweight": "bold",
    "axes.titlesize": 11,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.grid": True,
    "grid.color": "#e3e3e3",
    "grid.linewidth": 0.8,
    "xtick.color": INK,
    "ytick.color": INK,
    "savefig.dpi": 200,
    "savefig.bbox": "tight",
})


def es(valores, d=1, sufijo=""):
    """Etiquetas con coma decimal, como el resto del documento."""
    return [f"{v:.{d}f}".replace(".", ",") + sufijo for v in valores]

def resumen(nombre):
    return json.loads((DATA / f"{nombre}.json").read_text(encoding="utf-8"))["metrics"]


def progreso(nombre):
    """Lee las líneas 'running (…)' que k6 imprime cada segundo: (segundo, VUs, iteraciones)."""
    rx = re.compile(r"running \((\d+)m([\d.]+)s\), (\d+)/(\d+) VUs, (\d+) complete")
    filas = []
    for linea in io.open(DATA / f"{nombre}.txt", encoding="utf-8", errors="replace"):
        m = rx.search(linea)
        if m:
            t = int(m.group(1)) * 60 + float(m.group(2))
            filas.append((t, int(m.group(3)), int(m.group(5))))
    filas.sort()
    # k6 repite la última línea al cerrar: deja un solo punto por segundo.
    unicas, visto = [], set()
    for t, vus, it in filas:
        if t not in visto:
            visto.add(t)
            unicas.append((t, vus, it))
    return unicas


A = resumen("local-100clientes-1000reservas")
B = resumen("local-100clientes-5000reservas")
C = resumen("local-bloques-5000vu-1min")


# ── 1. Las dos corridas de reservas: tiempo y velocidad ────────────────────────
def g1():
    fig, (iz, de) = plt.subplots(1, 2, figsize=(9, 3.4))
    etiquetas = ["1000 reservas", "5000 reservas"]
    # Duración medida de cada corrida (la línea final de k6: "running (0m34.9s)" y "(02m20.4s)").
    minutos = [34.9, 140.4]
    velocidad = [A["reservas_creadas"]["rate"], B["reservas_creadas"]["rate"]]

    barras = iz.bar(etiquetas, minutos, color=[LIGHT, MID], edgecolor=INK, width=0.55)
    iz.set_title("Tiempo total de la corrida")
    iz.set_ylabel("segundos")
    iz.bar_label(barras, labels=es(minutos, 1, " s"), padding=3, color=INK)
    iz.set_ylim(0, max(minutos) * 1.25)

    barras = de.bar(etiquetas, velocidad, color=[LIGHT, MID], edgecolor=INK, width=0.55)
    de.set_title("Reservas creadas por segundo")
    de.set_ylabel("reservas/s")
    de.bar_label(barras, labels=es(velocidad, 1), padding=3, color=INK)
    de.set_ylim(0, max(velocidad) * 1.25)

    fig.suptitle("100 clientes simultáneos: 0 errores en las dos corridas", y=1.03, fontsize=11, fontweight="bold")
    fig.savefig(OUT / "80-01-reservas-tiempo-velocidad.png")
    plt.close(fig)


# ── 2. Reparto del tiempo de respuesta de la reserva ───────────────────────────
def g2():
    fig, ax = plt.subplots(figsize=(8, 3.6))
    claves = ["min", "med", "p(90)", "p(95)", "p(99)", "max"]
    nombres = ["mínimo", "mediana", "p90", "p95", "p99", "máximo"]
    x = range(len(claves))
    ancho = 0.38
    a = [A["reserva_ms"][k] / 1000 for k in claves]
    b = [B["reserva_ms"][k] / 1000 for k in claves]

    b1 = ax.bar([i - ancho / 2 for i in x], a, ancho, label="1000 reservas", color=LIGHT, edgecolor=INK)
    b2 = ax.bar([i + ancho / 2 for i in x], b, ancho, label="5000 reservas", color=MID, edgecolor=INK)
    ax.bar_label(b1, labels=es(a, 1), padding=2, fontsize=8, color=INK)
    ax.bar_label(b2, labels=es(b, 1), padding=2, fontsize=8, color=INK)
    ax.axhline(0.8, color=INK, linestyle="--", linewidth=1.2)
    ax.text(len(claves) - 0.5, 0.95, "meta p95 = 0,8 s", ha="right", fontsize=9, color=INK)
    ax.set_xticks(list(x))
    ax.set_xticklabels(nombres)
    ax.set_ylabel("segundos por reserva")
    ax.set_title("Tiempo de respuesta al registrar una reserva (100 clientes sin pausa)")
    ax.legend(frameon=False)
    fig.savefig(OUT / "80-02-latencia-reservas.png")
    plt.close(fig)


# ── 3. Prueba C: la subida a 5000 usuarios y lo que el sistema alcanza a hacer ─
def g3():
    filas = progreso("local-bloques-5000vu-1min")
    t0 = min(t for t, vus, _ in filas if vus > 0)
    segs = [t - t0 for t, _, _ in filas]
    vus = [v for _, v, _ in filas]
    tasa = [0.0]
    for i in range(1, len(filas)):
        dt = filas[i][0] - filas[i - 1][0]
        tasa.append((filas[i][2] - filas[i - 1][2]) / dt if dt > 0 else 0.0)

    fig, ax = plt.subplots(figsize=(9, 3.8))
    ax.plot(segs, vus, color=INK, linewidth=1.8, label="usuarios conectados")
    ax.set_xlabel("segundos desde el primer bloque")
    ax.set_ylabel("usuarios virtuales")
    ax.set_title("5000 usuarios en bloques de 100: la carga sube, el trabajo útil no")

    ax2 = ax.twinx()
    ax2.plot(segs, tasa, color=MID, linewidth=1.4, linestyle="--", label="iteraciones/s (casi todas fallan)")
    ax2.set_ylabel("iteraciones por segundo")
    ax2.grid(False)

    # Los 50 bloques de 100 usuarios ocupan 1 s cada uno: a los 50 s ya están los 5000 dentro.
    ax.axvline(50, color=LIGHT, linewidth=1.5)
    ax.text(51, max(vus) * 0.30, "5000 usuarios\nalcanzados", fontsize=8, color=INK)

    lineas = [l for l in ax.get_lines() + ax2.get_lines() if not l.get_label().startswith("_")]
    ax.legend(lineas, [l.get_label() for l in lineas], frameon=False, loc="upper left", fontsize=9)
    fig.savefig(OUT / "80-03-bloques-5000vu.png")
    plt.close(fig)


# ── 4. Prueba C: qué pasó con las peticiones ───────────────────────────────────
def g4():
    fig, (iz, de) = plt.subplots(1, 2, figsize=(9, 3.4))

    fallidas = C["http_req_failed"]["value"] * 100
    partes = [100 - fallidas, fallidas]
    barras = iz.barh(["correctas", "con error"], partes, color=[LIGHT, MID], edgecolor=INK, height=0.5)
    iz.bar_label(barras, labels=es(partes, 2, " %"), padding=4, color=INK)
    iz.set_xlim(0, 118)
    iz.set_xlabel("% de las 36.878 peticiones")
    iz.set_title("Resultado de las peticiones")
    iz.grid(axis="y", visible=False)

    dur = C["http_req_duration"]
    claves = ["med", "p(90)", "p(95)", "p(99)"]
    nombres = ["mediana", "p90", "p95", "p99"]
    valores = [dur[k] / 1000 for k in claves]
    barras = de.bar(nombres, valores, color=MID, edgecolor=INK, width=0.55)
    de.bar_label(barras, labels=es(valores, 1, " s"), padding=3, color=INK)
    de.axhline(10, color=INK, linestyle="--", linewidth=1.2)
    # La etiqueta va arriba del todo, sobre la barra más baja: a la altura de la línea choca
    # con los valores de p90 y p95, que valen justo 10 s.
    de.text(-0.40, 13.4, "la línea es el corte de Nginx (10 s)", ha="left", fontsize=9, color=INK)
    de.set_ylim(0, 14.8)
    de.set_ylabel("segundos")
    de.set_title("Tiempo de respuesta con 5000 usuarios")

    fig.savefig(OUT / "80-04-bloques-errores.png")
    plt.close(fig)


# ── 5. Dónde está el techo: lo que aguanta y lo que no ─────────────────────────
def g5():
    fig, ax = plt.subplots(figsize=(8, 3.4))
    casos = ["50\nclientes", "100\nclientes", "600\nusuarios", "700\nusuarios", "5000\nusuarios"]
    # Con 700 usuarios el error varió entre 85 % y 100 % según el bloque: la barra usa el punto
    # medio y la etiqueta dice el rango, para no inventar una cifra exacta que no se midió.
    errores = [0.0, 0.0, 0.0, 92.5, 98.64]
    etiquetas = ["0 %", "0 %", "0 %", "85 a 100 %", "98,64 %"]
    colores = [LIGHT, LIGHT, LIGHT, MID, INK]
    barras = ax.bar(casos, errores, color=colores, edgecolor=INK, width=0.6)
    ax.bar_label(barras, labels=etiquetas, padding=3, color=INK)
    ax.axhline(1, color=INK, linestyle="--", linewidth=1.2)
    ax.text(-0.45, 20, "la línea es la meta: menos del 1 %", ha="left", fontsize=9, color=INK)
    ax.set_ylim(0, 115)
    ax.set_ylabel("% de peticiones con error")
    ax.set_title("El punto de quiebre de la laptop está entre 600 y 700 usuarios")
    fig.savefig(OUT / "80-05-punto-de-quiebre.png")
    plt.close(fig)


for f in (g1, g2, g3, g4, g5):
    f()
    print("ok", f.__name__)

print("Gráficos en", OUT)
