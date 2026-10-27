"""
Genera los gráficos de rendimiento (PNG, escala de grises, legibles impresos sin color)
a partir de los resultados de k6 en docs/pruebas/datos/.

Uso:  python docs/pruebas/graficos.py
Requiere: matplotlib
"""
import csv
import gzip
import json
import statistics
from collections import defaultdict
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


def load_runs():
    runs = []
    for path in sorted(DATA.glob("escalon-*vu.json"), key=lambda p: int(p.stem.split("-")[1][:-2])):
        vus = int(path.stem.split("-")[1][:-2])
        m = json.loads(path.read_text(encoding="utf-8"))["metrics"]
        dur = m["http_req_duration"]
        failed = m.get("http_req_failed", {})
        runs.append({
            "vus": vus,
            "avg": dur["avg"], "med": dur["med"], "p90": dur["p(90)"], "p95": dur["p(95)"], "max": dur["max"],
            "rps": m["http_reqs"]["rate"], "reqs": m["http_reqs"]["count"],
            "fail_rate": failed.get("value", 0) * 100,
            "iterations": m.get("iterations", {}).get("count", 0),
        })
    return runs


def read_csv(vus):
    path = DATA / f"escalon-{vus}vu.csv.gz"
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        yield from csv.DictReader(fh)


def p(values, q):
    if not values:
        return 0
    s = sorted(values)
    k = max(0, min(len(s) - 1, int(round(q / 100 * len(s) + 0.5)) - 1))
    return s[k]


def chart_latency(runs):
    x = [r["vus"] for r in runs]
    fig, ax = plt.subplots(figsize=(7, 3.6))
    ax.plot(x, [r["med"] for r in runs], marker="o", color=INK, linestyle="-", label="Mediana (p50)")
    ax.plot(x, [r["p90"] for r in runs], marker="s", color=MID, linestyle="--", label="p90")
    ax.plot(x, [r["p95"] for r in runs], marker="^", color=INK, linestyle=":", linewidth=2, label="p95")
    ax.axhline(500, color=INK, linewidth=1, linestyle=(0, (6, 3)))
    ax.text(x[-1], 480, "Meta: p95 < 500 ms", fontsize=9, va="top", ha="right")
    # Solo se rotulan las cargas altas; los valores de 5 y 10 VU están en la tabla del informe.
    for r in runs[-2:]:
        ax.annotate(f"p95 {r['p95']:.0f} ms", (r["vus"], r["p95"]), textcoords="offset points",
                    xytext=(-8, 6), ha="right", fontsize=8)
    ax.set_xlabel("Usuarios virtuales simultáneos")
    ax.set_ylabel("Tiempo de respuesta (ms)")
    ax.set_title("Tiempo de respuesta según la carga")
    ax.set_xticks(x)
    ax.legend(frameon=False, loc="upper left")
    fig.savefig(OUT / "01-latencia-por-carga.png")
    plt.close(fig)


def chart_throughput(runs):
    x = [str(r["vus"]) for r in runs]
    fig, ax = plt.subplots(figsize=(7, 3.2))
    bars = ax.bar(x, [r["rps"] for r in runs], color=LIGHT, edgecolor=INK, hatch="//", width=0.55)
    for b, r in zip(bars, runs):
        ax.text(b.get_x() + b.get_width() / 2, b.get_height(), f"{r['rps']:.1f}", ha="center", va="bottom", fontsize=9)
    ax.set_xlabel("Usuarios virtuales simultáneos")
    ax.set_ylabel("Peticiones por segundo")
    ax.set_title("Peticiones atendidas por segundo")
    fig.savefig(OUT / "02-peticiones-por-segundo.png")
    plt.close(fig)


def chart_errors(runs):
    x = [str(r["vus"]) for r in runs]
    fig, ax = plt.subplots(figsize=(7, 3.0))
    bars = ax.bar(x, [r["fail_rate"] for r in runs], color="white", edgecolor=INK, hatch="xx", width=0.55)
    for b, r in zip(bars, runs):
        ax.text(b.get_x() + b.get_width() / 2, b.get_height(), f"{r['fail_rate']:.2f}%", ha="center", va="bottom", fontsize=9)
    ax.axhline(1, color=INK, linewidth=1, linestyle=(0, (6, 3)))
    ax.text(-0.4, 1.02, "Límite: 1%", fontsize=9, va="bottom")
    ax.set_ylim(0, max(2, max(r["fail_rate"] for r in runs) * 1.3))
    ax.set_xlabel("Usuarios virtuales simultáneos")
    ax.set_ylabel("Peticiones fallidas (%)")
    ax.set_title("Tasa de errores según la carga")
    fig.savefig(OUT / "03-tasa-de-errores.png")
    plt.close(fig)


def chart_by_type(runs):
    tipos = [("lectura", "Lecturas", "//"), ("login", "Login", ".."), ("escritura", "Crear reserva", "xx")]
    data = {}
    for r in runs:
        buckets = defaultdict(list)
        for row in read_csv(r["vus"]):
            if row["metric_name"] == "http_req_duration":
                tipo = row.get("tipo") or (json.loads(row["extra_tags"]) if row.get("extra_tags", "").startswith("{") else {}).get("tipo", "")
                if not tipo and "tipo=" in row.get("extra_tags", ""):
                    tipo = dict(t.split("=", 1) for t in row["extra_tags"].split("&") if "=" in t).get("tipo", "")
                if tipo:
                    buckets[tipo].append(float(row["metric_value"]))
        data[r["vus"]] = {t: p(v, 95) for t, v in buckets.items()}

    fig, ax = plt.subplots(figsize=(7, 3.4))
    width = 0.25
    xs = list(range(len(runs)))
    for i, (key, label, hatch) in enumerate(tipos):
        vals = [data[r["vus"]].get(key, 0) for r in runs]
        ax.bar([x + (i - 1) * width for x in xs], vals, width=width, color="white", edgecolor=INK, hatch=hatch, label=label)
    ax.set_xticks(xs, [str(r["vus"]) for r in runs])
    ax.set_xlabel("Usuarios virtuales simultáneos")
    ax.set_ylabel("p95 (ms)")
    ax.set_title("p95 por tipo de operación")
    ax.legend(frameon=False, ncol=3, loc="upper left")
    fig.savefig(OUT / "04-p95-por-operacion.png")
    plt.close(fig)
    return data


def chart_timeline(vus):
    per_second = defaultdict(list)
    vus_series = {}
    for row in read_csv(vus):
        if row.get("group") == "::setup":
            continue  # la fase setup (login de los usuarios de prueba) no es parte de la carga
        t = int(float(row["timestamp"]))
        if row["metric_name"] == "http_req_duration":
            per_second[t].append(float(row["metric_value"]))
        elif row["metric_name"] == "vus":
            vus_series[t] = float(row["metric_value"])
    if not per_second:
        return
    t0 = min(per_second) - 1
    vus_series = {k: v for k, v in vus_series.items() if k >= t0}
    secs = sorted(per_second)
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(7, 4.4), sharex=True, gridspec_kw={"height_ratios": [3, 1.3]})
    a1.plot([s - t0 for s in secs], [statistics.median(per_second[s]) for s in secs], color=MID, linewidth=1, label="Mediana por segundo")
    a1.plot([s - t0 for s in secs], [p(per_second[s], 95) for s in secs], color=INK, linewidth=1.4, label="p95 por segundo")
    a1.set_ylabel("ms")
    a1.set_ylim(bottom=0)
    a1.set_title(f"Evolución durante la corrida de {vus} usuarios virtuales")
    a1.legend(frameon=False, loc="lower center", ncol=2)
    vs = sorted(vus_series)
    a2.step([s - t0 for s in vs], [vus_series[s] for s in vs], where="post", color=INK)
    a2.set_ylabel("VU activos")
    a2.set_xlabel("Segundos desde el inicio")
    fig.savefig(OUT / f"05-evolucion-{vus}vu.png")
    plt.close(fig)


if __name__ == "__main__":
    runs = load_runs()
    if not runs:
        raise SystemExit("No hay resultados en docs/pruebas/datos/")
    chart_latency(runs)
    chart_throughput(runs)
    chart_errors(runs)
    by_type = chart_by_type(runs)
    chart_timeline(max(r["vus"] for r in runs))
    summary = {"runs": runs, "p95_por_tipo": by_type}
    (OUT / "resumen.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    for r in runs:
        print(f"{r['vus']:>3} VU  p50={r['med']:.1f}  p95={r['p95']:.1f}  rps={r['rps']:.1f}  errores={r['fail_rate']:.2f}%  peticiones={r['reqs']}")
