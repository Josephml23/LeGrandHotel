"""
Dibuja el diagrama de base de datos (notación pata de gallo) desde el esquema real exportado de MySQL
(columnas.tsv, claves-foraneas.tsv, indices.tsv). Salida: diagrama-bd.svg, .pdf y .png.

Uso:  python docs/diagramas/bd/dibujar.py   (requiere matplotlib)
"""
import csv
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Circle, Polygon, Rectangle  # noqa: E402

BASE = Path(__file__).resolve().parent
INTERNAS = {"cache", "cache_locks", "jobs", "job_batches", "failed_jobs", "migrations", "password_reset_tokens"}
LOGICAS = [  # relaciones que Laravel maneja sin clave foránea: hijo, columna, padre
    ("personal_access_tokens", "tokenable_id", "users"),
    ("sessions", "user_id", "users"),
]


def leer(nombre):
    with open(BASE / nombre, encoding="utf-8", newline="") as f:
        return [fila for fila in csv.reader(f, delimiter="\t") if fila]


columnas = defaultdict(list)
for tabla, _p, col, tipo, nulo, clave, _d, _e in leer("columnas.tsv"):
    columnas[tabla].append({"col": col, "tipo": tipo.replace(" unsigned", " uns."), "nulo": nulo == "YES", "clave": clave})
fks = [dict(zip(["hijo", "col", "padre", "ref", "regla", "nombre"], f)) for f in leer("claves-foraneas.tsv")]
unicos = {(t, c) for t, _n, nu, c in leer("indices.tsv") if nu == "0"}
fk_cols = {(f["hijo"], f["col"]) for f in fks} | {(h, c) for h, c, _p in LOGICAS}

# ── estilo ────────────────────────────────────────────────
INK, MID, HEAD, LINE = "#111111", "#555555", "#d9d9d9", "#333333"
ROW, CHAR = 0.30, 0.083  # alto de fila y ancho aprox. por carácter (unidades = pulgadas)
FS, FS_HEAD, FS_KEY = 9.5, 11, 8

# ── posición de cada tabla (x, y de la esquina superior izquierda) agrupadas por área ──
POS = {
    # Cuentas y permisos
    "roles": (0.4, 0.9), "role_user": (0.4, 3.4), "personal_access_tokens": (0.4, 5.2), "sessions": (0.4, 9.2),
    "audit_logs": (7.4, 0.9), "users": (7.4, 4.3), "staff": (7.4, 8.4),
    # Huéspedes y reservas
    "clients": (14.6, 0.9), "reservations": (21.4, 0.9), "stays": (21.4, 6.2),
    # Habitaciones
    "room_types": (28.0, 0.9), "rooms": (28.0, 4.3),
    # Cochera
    "parking_assignments": (28.0, 7.4), "parking_spots": (34.3, 7.4),
    # Inventario
    "inventory_movements": (14.6, 6.6), "inventory_items": (14.6, 10.0),
}
AREAS = [  # recuadros de fondo: título y vértices (x, y)
    ("Cuentas, permisos y auditoría", [(0.1, 0.25), (13.6, 0.25), (13.6, 12.9), (0.1, 12.9)]),
    ("Huéspedes, reservas y estadías", [(14.3, 0.25), (27.5, 0.25), (27.5, 12.9), (21.1, 12.9), (21.1, 5.55), (14.3, 5.55)]),
    ("Inventario", [(14.3, 5.85), (20.85, 5.85), (20.85, 12.9), (14.3, 12.9)]),
    ("Habitaciones", [(27.7, 0.25), (40.6, 0.25), (40.6, 6.75), (27.7, 6.75)]),
    ("Cochera", [(27.7, 6.95), (40.6, 6.95), (40.6, 12.9), (27.7, 12.9)]),
]


class Caja:
    def __init__(self, nombre, pos=None, ref=None):
        """ref: texto como «parte 1» si la tabla pertenece a otra parte y solo se muestra su id."""
        self.nombre = nombre
        self.ref = ref
        self.filas = columnas[nombre] if not ref else [f for f in columnas[nombre] if f["col"] == "id"]
        self.x, self.y = (pos or POS)[nombre]
        w_col = max(len(f["col"]) for f in self.filas) * CHAR + 0.25
        w_tipo = max(len(f["tipo"]) for f in self.filas) * CHAR + 0.2
        self.w_key, self.w_col, self.w_tipo, self.w_nulo = 0.62, w_col, w_tipo, 0.42
        self.w = max(self.w_key + w_col + w_tipo + self.w_nulo, len(nombre) * 0.11 + 0.4 + (1.3 if ref else 0))
        self.h = ROW * (len(self.filas) + 1)

    def fila_y(self, col):
        i = next(i for i, f in enumerate(self.filas) if f["col"] == col)
        return self.y + ROW * (i + 1.5)

    def dibujar(self, ax):
        borde = dict(ec=MID, lw=1.1, ls=(0, (4, 3))) if self.ref else dict(ec=INK, lw=1.2)
        ax.add_patch(Rectangle((self.x, self.y), self.w, self.h, fc="white", zorder=3, **borde))
        ax.add_patch(Rectangle((self.x, self.y), self.w, ROW, fc="#eeeeee" if self.ref else HEAD, zorder=3, **borde))
        titulo = f"{self.nombre}  ({self.ref})" if self.ref else self.nombre
        ax.text(self.x + self.w / 2, self.y + ROW / 2, titulo, ha="center", va="center", fontsize=FS_HEAD, weight="bold", color=MID if self.ref else INK, zorder=4)
        for i, f in enumerate(self.filas):
            yc = self.y + ROW * (i + 1.5)
            if i % 2:
                ax.add_patch(Rectangle((self.x, yc - ROW / 2), self.w, ROW, fc="#f4f4f4", ec="none", zorder=3))
            marcas = []
            if f["clave"] == "PRI":
                marcas.append("PK")
            if (self.nombre, f["col"]) in fk_cols:
                marcas.append("FK")
            if (self.nombre, f["col"]) in unicos and f["clave"] != "PRI":
                marcas.append("UK")
            peso = "bold" if f["clave"] == "PRI" else "normal"
            x = self.x + 0.08
            ax.text(x, yc, " ".join(marcas), va="center", fontsize=FS_KEY, weight="bold", color=MID, zorder=4)
            x = self.x + self.w_key
            ax.text(x, yc, f["col"], va="center", fontsize=FS, weight=peso, color=INK, zorder=4)
            ax.text(x + self.w_col, yc, f["tipo"], va="center", fontsize=FS - 1, color=MID, zorder=4)
            if f["nulo"]:
                ax.text(self.x + self.w - 0.08, yc, "NULL", va="center", ha="right", fontsize=FS_KEY - 0.5, color="#888888", zorder=4)

    def lado(self, s):
        return self.x if s == "L" else self.x + self.w


cajas = {n: Caja(n) for n in POS}
assert set(cajas) == {t for t in columnas if t not in INTERNAS}, "Hay tablas del esquema sin posición en el dibujo"

# ── conectores: hijo (col FK), padre, lado de salida del padre, lado de entrada al hijo, canal x, desfase y en el padre ──
RUTAS = {
    ("role_user", "user_id"): ("L", "R", None, 0.1),
    ("role_user", "role_id"): ("R", "R", 6.35, 0),
    ("personal_access_tokens", "tokenable_id"): ("L", "R", None, 0.9),
    ("sessions", "user_id"): ("L", "R", None, 1.7),
    ("staff", "user_id"): ("R", "R", 13.1, 1.2),
    ("audit_logs", "user_id"): ("R", "R", 12.8, -0.6),
    ("clients", "user_id"): ("R", "L", 13.4, 0.4),
    ("inventory_movements", "user_id"): ("R", "L", 13.7, 2.0),
    ("inventory_movements", "inventory_item_id"): ("R", "R", 20.6, 0),
    ("reservations", "client_id"): ("R", "L", None, 0),
    ("reservations", "room_id"): ("L", "R", 27.2, 0),
    ("stays", "reservation_id"): ("R", "R", 27.05, 0),
    ("rooms", "room_type_id"): ("R", "R", 40.2, 0),
    ("parking_assignments", "stay_id"): ("R", "L", 27.4, 0),
    ("parking_assignments", "parking_spot_id"): ("L", "R", None, 0),
}


def marca(ax, x, y, direccion, tipo):
    """Dibuja el extremo pata de gallo. direccion = +1 si la línea entra hacia la derecha, -1 hacia la izquierda."""
    d = direccion
    if tipo in ("uno", "cero_uno"):  # barra junto a la caja
        ax.plot([x - d * 0.14, x - d * 0.14], [y - 0.11, y + 0.11], color=LINE, lw=1.3, zorder=2)
    if tipo == "uno":
        ax.plot([x - d * 0.24, x - d * 0.24], [y - 0.11, y + 0.11], color=LINE, lw=1.3, zorder=2)
    if tipo in ("cero_uno", "cero_muchos"):
        ax.add_patch(Circle((x - d * 0.36, y), 0.075, fc="white", ec=LINE, lw=1.2, zorder=5))
    if tipo == "cero_muchos":  # pata de gallo
        for dy in (-0.13, 0, 0.13):
            ax.plot([x - d * 0.22, x], [y, y + dy], color=LINE, lw=1.2, zorder=2)


def conectar(ax, hijo, col, padre, regla, logica=False, cajas_=None, rutas=None):
    cajas_ = cajas_ or cajas
    lp, lh, canal, dy = (rutas or RUTAS)[(hijo, col)]
    cp, ch = cajas_[padre], cajas_[hijo]
    nulo = next(f["nulo"] for f in ch.filas if f["col"] == col)
    x1, y1 = cp.lado(lp), cp.fila_y("id") + dy
    x2, y2 = ch.lado(lh), ch.fila_y(col)
    if canal is None:
        canal = (x1 + x2) / 2
    estilo = dict(color=LINE, lw=1.2, zorder=1, ls=(0, (4, 3)) if logica else "-")
    ax.plot([x1, canal, canal, x2], [y1, y1, y2, y2], **estilo)
    marca(ax, x1, y1, -1 if lp == "R" else 1, "cero_uno" if nulo else "uno")
    marca(ax, x2, y2, 1 if canal < x2 else -1, "cero_uno" if (hijo, col) in unicos else "cero_muchos")
    texto = f"{col}" + (" · sin FK" if logica else f" · {regla}")
    xt = x2 + (-0.45 if canal < x2 else 0.45)
    ax.text(xt, y2 - 0.12, texto, ha="right" if canal < x2 else "left", va="bottom", fontsize=7.5, color=MID, zorder=6,
            bbox=dict(fc="white", ec="none", pad=0.6, alpha=0.9))


fig = plt.figure(figsize=(41, 15.7))
ax = fig.add_axes([0, 0, 1, 1])
ax.set_xlim(0, 41)
ax.set_ylim(15.7, -0.9)
ax.axis("off")

ax.text(0.1, -0.45, "LeGrandHotel · Diagrama de base de datos", fontsize=20, weight="bold", color=INK, va="center")
ax.text(13.2, -0.45, "MySQL 8.4 · esquema legrandhotel · leído de information_schema el 2026-10-27 · 16 tablas del sistema, 13 claves foráneas y 2 relaciones sin clave foránea",
        fontsize=11, color=MID, va="center")
for titulo, vertices in AREAS:
    ax.add_patch(Polygon(vertices, closed=True, fc="#fafafa", ec="#bbbbbb", lw=1, ls=(0, (6, 4)), zorder=0))
    x0, y0 = vertices[0]
    ax.text(x0 + 0.15, y0 + 0.28, titulo.upper(), fontsize=9.5, weight="bold", color="#777777", zorder=0)

for f in fks:
    conectar(ax, f["hijo"], f["col"], f["padre"], f["regla"])
for hijo, col, padre in LOGICAS:
    conectar(ax, hijo, col, padre, "", logica=True)
for c in cajas.values():
    c.dibujar(ax)

def leyenda(ax, x0, ly, fs=9.5):
    ax.text(x0, ly, "Cómo leerlo", fontsize=fs + 1.5, weight="bold", color=INK)
    x = x0
    for tipo, txt in [("uno", "exactamente uno"), ("cero_uno", "cero o uno"), ("cero_muchos", "cero o muchos")]:
        ax.plot([x, x + 0.9], [ly + 0.55, ly + 0.55], color=LINE, lw=1.2)
        marca(ax, x + 0.9, ly + 0.55, 1, tipo)
        ax.text(x + 1.05, ly + 0.55, txt, va="center", fontsize=fs, color=INK)
        x += 2.6
    ax.plot([x, x + 0.9], [ly + 0.55, ly + 0.55], color=LINE, lw=1.2, ls=(0, (4, 3)))
    ax.text(x + 1.05, ly + 0.55, "sin clave foránea", va="center", fontsize=fs, color=INK)


leyenda(ax, 0.1, 13.45)
ax.text(0.1, 13.45 + 1.15, "PK clave primaria · FK clave foránea · UK valor único · NULL la columna acepta vacío · "
        "junto a cada línea: la columna FK y qué hace MySQL al borrar el registro padre, su regla ON DELETE (CASCADE borra los hijos, SET NULL los deja sin padre, RESTRICT impide borrar).",
        fontsize=9.5, color=INK)
ax.text(0.1, 13.45 + 1.65, "Tablas internas de Laravel, sin relaciones (no dibujadas): " + ", ".join(sorted(INTERNAS)) + ".", fontsize=9.5, color=MID)

for ext in ("svg", "pdf", "png"):
    fig.savefig(BASE / f"diagrama-bd.{ext}", dpi=170 if ext == "png" else None)
plt.close(fig)

# ── el mismo diagrama en 3 partes, para leerlo en una página cada una ──
PARTES = [
    ("1", "Cuentas, permisos y auditoría", (13.50, 12.2), {
        "roles": (2.00, 0.9), "role_user": (2.00, 3.3), "personal_access_tokens": (2.00, 4.8), "sessions": (2.00, 8.8),
        "users": (8.10, 0.9), "staff": (8.10, 4.7), "audit_logs": (8.10, 7.9),
    }, {}, {
        ("role_user", "user_id"): ("L", "R", 7.00, 0.1),
        ("role_user", "role_id"): ("L", "L", 1.55, 0),
        ("personal_access_tokens", "tokenable_id"): ("L", "R", 7.30, 0.9),
        ("sessions", "user_id"): ("L", "R", 7.60, 1.8),
        ("staff", "user_id"): ("R", "R", 12.55, 0.6),
        ("audit_logs", "user_id"): ("R", "R", 12.85, 1.2),
    }, "users también es padre de clients (parte 2) e inventory_movements (parte 3)."),
    ("2", "Huéspedes, reservas y habitaciones", (13.70, 12.2), {
        "users": (2.00, 0.9), "clients": (2.00, 2.4), "room_types": (2.00, 6.6),
        "reservations": (8.00, 0.9), "rooms": (8.00, 5.6), "stays": (8.00, 8.8),
    }, {"users": "parte 1"}, {
        ("clients", "user_id"): ("L", "L", 1.55, 0),
        ("reservations", "client_id"): ("R", "L", None, 0),
        ("rooms", "room_type_id"): ("R", "L", None, 0),
        ("reservations", "room_id"): ("R", "R", 12.70, 0),
        ("stays", "reservation_id"): ("R", "R", 13.00, 0.3),
    }, "stays también es padre de parking_assignments (parte 3)."),
    ("3", "Cochera e inventario", (12.4, 10.6), {
        "parking_spots": (0.9, 0.9), "stays": (0.9, 3.3),
        "inventory_items": (0.9, 5.4), "users": (0.9, 8.5),
        "parking_assignments": (7.0, 0.9), "inventory_movements": (7.0, 5.4),
    }, {"stays": "parte 2", "users": "parte 1"}, {
        ("parking_assignments", "parking_spot_id"): ("R", "L", 6.3, 0),
        ("parking_assignments", "stay_id"): ("R", "L", 5.9, 0),
        ("inventory_movements", "inventory_item_id"): ("R", "L", 6.3, 0),
        ("inventory_movements", "user_id"): ("R", "L", 5.9, 0),
    }, ""),
]

for num, titulo, (ancho, alto), pos, refs, rutas, nota in PARTES:
    cj = {n: Caja(n, pos, refs.get(n)) for n in pos}
    fig = plt.figure(figsize=(ancho, alto + 2.2))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, ancho)
    ax.set_ylim(alto + 1.6, -0.6)
    ax.axis("off")
    ax.text(0.15, -0.2, f"Parte {num}. {titulo}", fontsize=16, weight="bold", color=INK, va="center")
    for f in fks:
        if f["hijo"] in cj and f["padre"] in cj:
            conectar(ax, f["hijo"], f["col"], f["padre"], f["regla"], cajas_=cj, rutas=rutas)
    for hijo, col, padre in LOGICAS:
        if hijo in cj and padre in cj:
            conectar(ax, hijo, col, padre, "", logica=True, cajas_=cj, rutas=rutas)
    for c in cj.values():
        c.dibujar(ax)
    ancho_real = max(c.x + c.w for c in cj.values())
    assert ancho_real < ancho - 0.2, f"parte {num}: las tablas pasan el ancho ({ancho_real:.1f})"
    leyenda(ax, 0.15, alto + 0.05, fs=9)
    if nota:
        ax.text(0.15, alto + 1.15, "Recuadro punteado = tabla de otra parte (solo su id). " + nota, fontsize=9, color=MID)
    for ext in ("pdf", "png"):
        fig.savefig(BASE / f"diagrama-bd-parte{num}.{ext}", dpi=220 if ext == "png" else None)
    plt.close(fig)
print("ok")
