"""
Prueba de aguante (tests/k6/correr-aguante.sh): en tramos de 10 s muestra usuarios activos, peticiones por segundo,
p95 y errores, y calcula cuánto tiempo respondió sin errores. Gráfico en escala de grises.

Uso:  python docs/pruebas/aguante.py 1000
Lee:  docs/pruebas/datos/local-aguante-<VUS>vu.csv.gz
Deja: docs/pruebas/graficos/aguante-<VUS>vu.png y docs/pruebas/datos/local-aguante-<VUS>vu-tramos.json
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
WINDOW = 10


def p95(values):
    values = sorted(values)
    return values[max(0, math.ceil(0.95 * len(values)) - 1)] if values else 0.0


def load(vus):
    reqs = []  # (ts, duración ms, falló)
    vus_at = defaultdict(float)
    pending = {}
    with gzip.open(DATA / f"local-aguante-{vus}vu.csv.gz", "rt", encoding="utf-8") as fh:
        try:
            for row in csv.DictReader(fh):
                name = row["metric_name"]
                ts = float(row["timestamp"])
                if name == "vus":
                    vus_at[int(ts)] = max(vus_at[int(ts)], float(row["metric_value"]))
                elif row.get("scenario") == "default" and name == "http_req_duration":
                    pending.setdefault((ts, row["url"]), []).append(float(row["metric_value"]))
                elif row.get("scenario") == "default" and name == "http_req_failed":
                    key = (ts, row["url"])
                    if pending.get(key):
                        reqs.append((ts, pending[key].pop(0), float(row["metric_value"]) > 0))
        except (EOFError, ValueError, KeyError, TypeError):
            pass
    return reqs, vus_at


def windows(vus):
    reqs, vus_at = load(vus)
    # Se cuenta desde la primera petición de los usuarios (antes, k6 inicia sesión con las cuentas de prueba).
    start = min(ts for ts, _, _ in reqs)
    end = max(ts for ts, _, _ in reqs)
    rows = []
    for i in range(int((end - start) // WINDOW) + 1):
        lo, hi = start + i * WINDOW, start + (i + 1) * WINDOW
        chunk = [(d, f) for ts, d, f in reqs if lo <= ts < hi]
        active = max((v for s, v in vus_at.items() if lo <= s < hi), default=0)
        if not chunk:
            continue
        rows.append({
            "desde": i * WINDOW,
            "usuarios": int(active),
            "peticiones": len(chunk),
            "pet_s": len(chunk) / WINDOW,
            "p95_s": p95([d for d, _ in chunk]) / 1000,
            "errores_pct": 100 * sum(1 for _, f in chunk if f) / len(chunk),
        })
    first_error = min((ts for ts, _, f in reqs if f), default=None)
    first_bad = next((r for r in rows if r["errores_pct"] > 1), None)
    summary = {
        "primer_error_s": None if first_error is None else round(first_error - start, 1),
        "primer_tramo_con_mas_de_1pct": None if first_bad is None else first_bad["desde"],
        "usuarios_en_ese_momento": None if first_bad is None else first_bad["usuarios"],
    }
    return rows, summary


def chart(vus, rows):
    x = [r["desde"] for r in rows]
    fig, ax = plt.subplots(figsize=(8.5, 4.4))
    ax.bar(x, [r["errores_pct"] for r in rows], width=WINDOW * 0.7, align="edge", color="#cccccc", label="errores (%)")
    ax.set_ylim(0, 100)
    ax.set_ylabel("errores (%)")
    ax.set_xlabel("segundos desde el inicio (tramos de 10 s)")
    ax2 = ax.twinx()
    ax2.plot([v + WINDOW / 2 for v in x], [r["p95_s"] for r in rows], color="#111111", marker="o", markersize=3, label="p95 (s)")
    ax2.plot([v + WINDOW / 2 for v in x], [r["usuarios"] / 100 for r in rows], color="#777777", linestyle="--", label="usuarios activos (÷100)")
    ax2.set_ylabel("p95 (s) · usuarios ÷ 100")
    ax2.set_ylim(0, max(max(r["p95_s"] for r in rows), max(r["usuarios"] for r in rows) / 100) * 1.25)
    h1, l1 = ax.get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    ax.legend(h1 + h2, l1 + l2, loc="upper center", bbox_to_anchor=(0.5, -0.15), ncol=3, frameon=False, fontsize=9)
    ax.set_title(f"Prueba de aguante local: {vus} usuarios en 1 minuto y sostenidos")
    ax.spines["top"].set_visible(False)
    fig.tight_layout()
    path = OUT / f"aguante-{vus}vu.png"
    fig.savefig(path, dpi=160)
    return path


if __name__ == "__main__":
    vus = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
    rows, summary = windows(vus)
    print("| Desde (s) | Usuarios | Peticiones | Pet./s | p95 | Errores |")
    print("| ---: | ---: | ---: | ---: | ---: | ---: |")
    for r in rows:
        print(f"| {r['desde']} | {r['usuarios']} | {r['peticiones']} | {r['pet_s']:.1f} | {r['p95_s']:.2f} s | {r['errores_pct']:.1f}% |")
    print(summary)
    (DATA / f"local-aguante-{vus}vu-tramos.json").write_text(json.dumps({"tramos": rows, "resumen": summary}, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Gráfico:", chart(vus, rows).relative_to(BASE.parent.parent))
