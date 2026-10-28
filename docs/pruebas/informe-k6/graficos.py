"""
Gráficos del informe de pruebas k6 (escala de grises), en español e inglés, para cada serie de escalones:
recepción (salidas/3-escalon-*.json → graficos/) y clientes del portal (salidas/4-clientes-*.json → graficos-clientes/).

Uso:  python docs/pruebas/informe-k6/graficos.py
"""
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

BASE = Path(__file__).resolve().parent
SAL = BASE / "salidas"

INK, MID, LIGHT = "#111111", "#666666", "#bbbbbb"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 10, "axes.edgecolor": MID, "axes.labelcolor": INK,
    "axes.titleweight": "bold", "axes.titlesize": 11, "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.color": "#e3e3e3", "grid.linewidth": 0.8,
})

VUS = [5, 10, 25, 50]
SERIES = [("3-escalon", "graficos", "resumen.json"), ("4-clientes", "graficos-clientes", "resumen-clientes.json")]


def graficar(prefijo, carpeta_base, resumen):
    if not all((SAL / f"{prefijo}-{v}vu.json").exists() for v in VUS):
        return
    rows = []
    for v in VUS:
        m = json.loads((SAL / f"{prefijo}-{v}vu.json").read_text(encoding="utf-8"))["metrics"]
        d = m["http_req_duration"]
        rows.append({
            "vus": v,
            "reqs": m["http_reqs"]["count"],
            "rps": m["http_reqs"]["rate"],
            "p50": d["med"], "p95": d["p(95)"], "avg": d["avg"], "max": d["max"],
            "failed": m["http_req_failed"]["value"] * 100,
        })
    (BASE / resumen).write_text(json.dumps(rows, indent=2), encoding="utf-8")
    x = [str(r["vus"]) for r in rows]

    # Mismos gráficos en español (graficos/) e inglés (graficos-en/).
    TEXTOS = {
        "es": {"dir": carpeta_base, "f1": "01-latencia.png", "f2": "02-peticiones-por-segundo.png", "meta": "meta p95 < 500 ms",
               "p50": "p50 (mediana)", "vu": "Usuarios virtuales (VU)", "tiempo": "Tiempo de respuesta (ms)",
               "t1": "Tiempo de respuesta según la cantidad de usuarios", "ps": "Peticiones por segundo", "t2": "Peticiones atendidas por segundo"},
        "en": {"dir": carpeta_base + "-en", "f1": "01-latency.png", "f2": "02-requests-per-second.png", "meta": "goal p95 < 500 ms",
               "p50": "p50 (median)", "vu": "Virtual users (VU)", "tiempo": "Response time (ms)",
               "t1": "Response time by number of users", "ps": "Requests per second", "t2": "Requests served per second"},
    }
    for tx in TEXTOS.values():
        carpeta = BASE / tx["dir"]
        carpeta.mkdir(exist_ok=True)

        fig, ax = plt.subplots(figsize=(7, 3.6))
        ax.plot(x, [r["p95"] for r in rows], marker="o", color=INK, linewidth=2, label="p95")
        ax.plot(x, [r["p50"] for r in rows], marker="s", color=MID, linewidth=2, linestyle="--", label=tx["p50"])
        ax.axhline(500, color=LIGHT, linewidth=1.5, linestyle=":")
        ax.text(0.02, 520, tx["meta"], color=MID, fontsize=9)
        for i, r in enumerate(rows):
            ax.annotate(f"{r['p95']:.0f} ms", (i, r["p95"]), textcoords="offset points", xytext=(0, 8), ha="center", fontsize=9)
        ax.set_xlabel(tx["vu"])
        ax.set_ylabel(tx["tiempo"])
        ax.set_title(tx["t1"])
        ax.legend(frameon=False)
        fig.tight_layout()
        fig.savefig(carpeta / tx["f1"], dpi=200)
        plt.close(fig)

        fig, ax = plt.subplots(figsize=(7, 3.2))
        bars = ax.bar(x, [r["rps"] for r in rows], color=[LIGHT, "#999999", MID, INK], width=0.55)
        for bar, r in zip(bars, rows):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.1, f"{r['rps']:.1f}", ha="center", fontsize=9)
        ax.set_xlabel(tx["vu"])
        ax.set_ylabel(tx["ps"])
        ax.set_title(tx["t2"])
        fig.tight_layout()
        fig.savefig(carpeta / tx["f2"], dpi=200)
        plt.close(fig)

    print(prefijo, json.dumps(rows))


for serie in SERIES:
    graficar(*serie)
