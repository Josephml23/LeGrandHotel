"""
Gráficos del informe de pruebas k6 (escala de grises) a partir de salidas/3-escalon-*.json.

Uso:  python docs/pruebas/informe-k6/graficos.py
"""
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

BASE = Path(__file__).resolve().parent
SAL = BASE / "salidas"
OUT = BASE / "graficos"
OUT.mkdir(exist_ok=True)

INK, MID, LIGHT = "#111111", "#666666", "#bbbbbb"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10, "axes.edgecolor": MID, "axes.labelcolor": INK,
    "axes.titleweight": "bold", "axes.titlesize": 11, "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.color": "#e3e3e3", "grid.linewidth": 0.8,
})

VUS = [5, 10, 25, 50]
rows = []
for v in VUS:
    m = json.loads((SAL / f"3-escalon-{v}vu.json").read_text(encoding="utf-8"))["metrics"]
    d = m["http_req_duration"]
    rows.append({
        "vus": v,
        "reqs": m["http_reqs"]["count"],
        "rps": m["http_reqs"]["rate"],
        "p50": d["med"], "p95": d["p(95)"], "avg": d["avg"], "max": d["max"],
        "failed": m["http_req_failed"]["value"] * 100,
    })
(BASE / "resumen.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")

x = [str(r["vus"]) for r in rows]

fig, ax = plt.subplots(figsize=(7, 3.6))
ax.plot(x, [r["p95"] for r in rows], marker="o", color=INK, linewidth=2, label="p95")
ax.plot(x, [r["p50"] for r in rows], marker="s", color=MID, linewidth=2, linestyle="--", label="p50 (mediana)")
ax.axhline(500, color=LIGHT, linewidth=1.5, linestyle=":")
ax.text(0.02, 520, "meta p95 < 500 ms", color=MID, fontsize=9)
for i, r in enumerate(rows):
    ax.annotate(f"{r['p95']:.0f} ms", (i, r["p95"]), textcoords="offset points", xytext=(0, 8), ha="center", fontsize=9)
ax.set_xlabel("Usuarios virtuales (VU)")
ax.set_ylabel("Tiempo de respuesta (ms)")
ax.set_title("Tiempo de respuesta según la cantidad de usuarios")
ax.legend(frameon=False)
fig.tight_layout()
fig.savefig(OUT / "01-latencia.png", dpi=200)

fig, ax = plt.subplots(figsize=(7, 3.2))
bars = ax.bar(x, [r["rps"] for r in rows], color=[LIGHT, "#999999", MID, INK], width=0.55)
for b, r in zip(bars, rows):
    ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 0.1, f"{r['rps']:.1f}", ha="center", fontsize=9)
ax.set_xlabel("Usuarios virtuales (VU)")
ax.set_ylabel("Peticiones por segundo")
ax.set_title("Peticiones atendidas por segundo")
fig.tight_layout()
fig.savefig(OUT / "02-peticiones-por-segundo.png", dpi=200)

print(json.dumps(rows, indent=2))
