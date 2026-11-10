"""
Resultados de las pruebas por bloques de 100 usuarios (tests/k6/correr-bloques.sh): para cada bloque,
peticiones por segundo, p95 y porcentaje de errores. Imprime la tabla en Markdown y genera un gráfico
en escala de grises (legible impreso sin color).

Uso:  python docs/pruebas/bloques.py 1000            (bloques de 30 s)
      python docs/pruebas/bloques.py 1000:60         (bloques de 1 minuto)
Lee:  docs/pruebas/datos/local-bloques-<VUS>vu[-60s].csv.gz
Deja: docs/pruebas/graficos/bloques-<VUS>vu[-60s].png
"""
import csv
import gzip
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

BASE = Path(__file__).resolve().parent
DATA = BASE / "datos"
OUT = BASE / "graficos"
OUT.mkdir(exist_ok=True)

BLOCK = 100


def p95(values):
    values = sorted(values)
    return values[max(0, math.ceil(0.95 * len(values)) - 1)] if values else 0.0


def blocks(vus, block_seconds=30, suffix=""):
    """Agrupa cada petición del escenario por el bloque en que ocurrió."""
    durations, failed = defaultdict(list), defaultdict(list)
    start = None
    with gzip.open(DATA / f"local-bloques-{vus}vu{suffix}.csv.gz", "rt", encoding="utf-8") as fh:
        try:
            for row in csv.DictReader(fh):
                if row.get("scenario") != "default" or row["metric_name"] not in ("http_req_duration", "http_req_failed"):
                    continue
                ts = float(row["timestamp"])
                start = ts if start is None else min(start, ts)
                (durations if row["metric_name"] == "http_req_duration" else failed)[ts].append(float(row["metric_value"]))
        except (EOFError, ValueError, KeyError, TypeError):
            pass  # corrida detenida a la mitad: se usa lo que alcanzó a escribir
    total_blocks = vus // BLOCK
    rows = []
    for i in range(total_blocks):
        lo, hi = start + i * block_seconds, start + (i + 1) * block_seconds
        d = [v for ts, vals in durations.items() if lo <= ts < hi for v in vals]
        f = [v for ts, vals in failed.items() if lo <= ts < hi for v in vals]
        if not d:
            break  # la corrida se detuvo antes (vigilante de memoria)
        rows.append({
            "vus": (i + 1) * BLOCK,
            "reqs": len(d),
            "rps": len(d) / block_seconds,
            "p95": p95(d) / 1000,
            "errors": 100 * sum(f) / len(f) if f else 0.0,
        })
    return rows


def table(vus, rows, block_seconds=30):
    print(f"\n### {vus} usuarios, bloques de {BLOCK} ({block_seconds} s cada uno)\n")
    print("| Usuarios | Peticiones | Pet./s | p95 | Errores |")
    print("| ---: | ---: | ---: | ---: | ---: |")
    for r in rows:
        print(f"| {r['vus']} | {r['reqs']} | {r['rps']:.1f} | {r['p95']:.2f} s | {r['errors']:.1f}% |")


def chart(vus, rows, block_seconds=30, suffix=""):
    x = [r["vus"] for r in rows]
    fig, ax = plt.subplots(figsize=(8, 4.2))
    ax.plot(x, [r["p95"] for r in rows], color="#111111", marker="o", markersize=3, label="p95 (s)")
    ax.axhline(0.8, color="#666666", linestyle="--", linewidth=1, label="meta p95 0,8 s")
    ax.set_xlabel("usuarios virtuales (bloques de 100)")
    ax.set_ylabel("p95 (segundos)")
    ax2 = ax.twinx()
    ax2.bar(x, [r["errors"] for r in rows], width=BLOCK * 0.6, color="#bbbbbb", label="errores (%)", zorder=0)
    ax2.set_ylabel("errores (%)")
    ax2.set_ylim(0, 100)
    ax.set_zorder(ax2.get_zorder() + 1)
    ax.patch.set_visible(False)
    lines = ax.get_legend_handles_labels()
    bars = ax2.get_legend_handles_labels()
    ax.legend(lines[0] + bars[0], lines[1] + bars[1], loc="upper left", frameon=False)
    ax.set_title(f"Prueba local por bloques de {BLOCK} ({block_seconds} s): hasta {vus} usuarios")
    fig.tight_layout()
    path = OUT / f"bloques-{vus}vu{suffix}.png"
    fig.savefig(path, dpi=160)
    print(f"\nGráfico: {path.relative_to(BASE.parent.parent)}")


if __name__ == "__main__":
    for arg in sys.argv[1:] or ["1000"]:
        vus, _, secs = arg.partition(":")
        vus, secs = int(vus), int(secs or 30)
        suffix = "" if secs == 30 else f"-{secs}s"
        data = blocks(vus, secs, suffix)
        (DATA / f"local-bloques-{vus}vu{suffix}-bloques.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
        table(vus, data, secs)
        chart(vus, data, secs, suffix)
