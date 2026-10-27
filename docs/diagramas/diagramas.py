"""
Dibuja los diagramas del informe en escala de grises (se leen bien impresos sin color):
  arquitectura.png  — arquitectura en AWS
  base-de-datos.png — modelo entidad-relación (resumen de docs/diagramas/legrandhotel.dbml)
Uso: python docs/diagramas/diagramas.py
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle  # noqa: E402

OUT = Path(__file__).resolve().parent
INK, MID, FILL = "#111111", "#555555", "#eeeeee"


# ── Arquitectura ─────────────────────────────────────────────────────────
def box(ax, x, y, w, h, title, lines=(), dashed=False, fill="white"):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0,rounding_size=0.12",
                                fc=fill, ec=INK, lw=1.3, ls="--" if dashed else "-", zorder=2))
    ax.text(x + w / 2, y + h - 0.3, title, ha="center", va="top", fontsize=10.5, fontweight="bold", zorder=3)
    for i, line in enumerate(lines):
        ax.text(x + w / 2, y + h - 0.78 - i * 0.36, line, ha="center", va="top", fontsize=8.8, zorder=3)


def arrow(ax, a, b, dashed=False):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle="-|>", mutation_scale=13, color=INK, lw=1.2,
                                 ls="--" if dashed else "-", shrinkA=0, shrinkB=0, zorder=1))


def label(ax, x, y, text, ha="center"):
    ax.text(x, y, text, ha=ha, va="center", fontsize=8.5, zorder=4,
            bbox=dict(fc="white", ec="none", pad=1.5))


def arquitectura():
    fig, ax = plt.subplots(figsize=(12, 8.4))
    ax.set_xlim(0, 20)
    ax.set_ylim(0, 14)
    ax.axis("off")

    # Fila superior: usuario, sitio web estático y CI/CD.
    box(ax, 0.3, 11.6, 3.0, 1.7, "Usuario", ["Navegador web"])
    box(ax, 5.0, 11.8, 3.4, 1.5, "CloudFront", ["HTTPS · caché"])
    box(ax, 10.0, 11.8, 3.4, 1.5, "S3 (privado)", ["React ofuscado"])
    box(ax, 16.0, 11.8, 3.6, 1.5, "GitHub Actions", ["CI/CD · OIDC"], dashed=True)
    arrow(ax, (3.3, 12.55), (5.0, 12.55))
    label(ax, 4.15, 12.95, "sitio web")
    arrow(ax, (8.4, 12.55), (10.0, 12.55))

    # VPC con subredes pública y privada.
    ax.add_patch(Rectangle((3.6, 0.9), 11.6, 9.9, fc="white", ec=INK, lw=1.6, zorder=0))
    ax.text(3.8, 10.5, "VPC 10.20.0.0/16 · us-east-1", fontsize=10, fontweight="bold", va="center")
    ax.add_patch(Rectangle((3.9, 5.6), 11.0, 4.4, fc=FILL, ec=MID, lw=0.9, ls="--", zorder=0))
    ax.text(4.1, 9.7, "Subredes públicas (2 zonas)", fontsize=8.8, color=MID, va="center")
    ax.add_patch(Rectangle((3.9, 1.2), 11.0, 3.9, fc="white", ec=MID, lw=0.9, ls="--", zorder=0))
    ax.text(4.1, 4.8, "Subredes privadas (2 zonas)", fontsize=8.8, color=MID, va="center")
    ax.text(4.1, 4.4, "sin acceso desde internet", fontsize=8.8, color=MID, va="center")

    box(ax, 4.4, 6.2, 3.6, 2.9, "Load Balancer", ["HTTPS 443", "health check:", "/api/v1/health"])
    box(ax, 9.6, 6.0, 4.9, 3.2, "EC2 · Auto Scaling 1–3", ["Docker: Nginx + PHP-FPM", "Laravel 12", "worker de colas · scheduler", "t3.small"])
    arrow(ax, (8.0, 7.65), (9.6, 7.65))
    label(ax, 8.8, 8.15, "solo ALB")

    box(ax, 7.6, 1.6, 3.4, 2.6, "RDS MySQL 8", ["cifrada", "snapshots 7 días"])
    box(ax, 11.4, 1.6, 3.2, 2.6, "Redis", ["ElastiCache", "caché · colas"], dashed=True)
    arrow(ax, (10.3, 6.0), (10.3, 4.2))
    label(ax, 10.3, 5.35, "3306")
    arrow(ax, (13.0, 6.0), (13.0, 4.2))
    label(ax, 13.0, 5.35, "6379")

    # Usuario → API: baja por el margen izquierdo y entra al balanceador.
    ax.plot([1.8, 1.8], [11.6, 7.65], color=INK, lw=1.2, zorder=1)
    arrow(ax, (1.8, 7.65), (4.4, 7.65))
    label(ax, 1.8, 9.6, "API (HTTPS)")

    # Servicios administrados a la derecha.
    box(ax, 16.0, 8.4, 3.6, 1.6, "SSM", ["secretos"])
    box(ax, 16.0, 6.0, 3.6, 1.8, "CloudWatch", ["logs JSON", "alarmas"])
    box(ax, 16.0, 3.4, 3.6, 1.8, "S3 respaldos", ["mysqldump diario"])
    arrow(ax, (14.5, 8.7), (16.0, 9.2))
    arrow(ax, (14.5, 6.9), (16.0, 6.9))
    arrow(ax, (14.5, 6.3), (16.0, 4.3))

    # Despliegue: baja desde GitHub Actions por fuera de la VPC.
    ax.plot([17.8, 17.8], [11.8, 11.2], color=INK, lw=1.2, ls="--", zorder=1)
    ax.plot([17.8, 12.05], [11.2, 11.2], color=INK, lw=1.2, ls="--", zorder=1)
    arrow(ax, (12.05, 11.2), (12.05, 9.2), dashed=True)
    label(ax, 15.6, 11.2, "despliega")

    ax.text(0.3, 0.35, "Línea discontinua: componentes de entregas posteriores (Redis en el 80%, CI/CD en el 100%).",
            fontsize=8.5, color=MID)
    fig.savefig(OUT / "arquitectura.png", dpi=200, bbox_inches="tight")
    plt.close(fig)


# ── Base de datos ────────────────────────────────────────────────────────
COL_W, COL_STEP, ROW = 3.9, 5.0, 0.34
COL_X = [0.3 + i * COL_STEP for i in range(5)]
ROW_TOP = [13.4, 9.6, 6.5]

TABLES = {
    "users": (0, 0, ["id", "name", "email (único)", "password (bcrypt)", "google_id", "email_verified_at"]),
    "clients": (1, 0, ["id", "user_id → users", "document_number (único)", "full_name", "phone", "nationality"]),
    "room_types": (2, 0, ["id", "name (único)", "capacity", "price_per_night"]),
    "reservations": (3, 0, ["id", "client_id → clients", "room_id → rooms", "check_in, check_out (índice)", "status", "total"]),
    "parking_spots": (4, 0, ["id", "code (único)", "status"]),
    "role_user": (0, 1, ["user_id → users", "role_id → roles"]),
    "staff": (1, 1, ["id", "user_id → users", "position", "shift", "hired_at"]),
    "rooms": (2, 1, ["id", "room_type_id → room_types", "number (único)", "floor", "status (índice)"]),
    "stays": (3, 1, ["id", "reservation_id → reservations", "checked_in_at", "checked_out_at"]),
    "parking_assignments": (4, 1, ["id", "parking_spot_id → spots", "stay_id → stays", "plate", "entered_at, left_at"]),
    "roles": (0, 2, ["id", "name (único)", "label"]),
    "audit_logs": (1, 2, ["id", "user_id → users", "action", "entity", "created_at"]),
    "inventory_items": (2, 2, ["id", "name (índice)", "unit", "stock", "min_stock"]),
    "inventory_movements": (3, 2, ["id", "inventory_item_id → items", "user_id → users", "type (in / out)", "quantity"]),
}


def tabla(ax, name, col, row, cols):
    x, top = COL_X[col], ROW_TOP[row]
    h = 0.5 + ROW * len(cols)
    ax.add_patch(Rectangle((x, top - h), COL_W, h, fc="white", ec=INK, lw=1.2, zorder=2))
    ax.add_patch(Rectangle((x, top - 0.5), COL_W, 0.5, fc="#dcdcdc", ec=INK, lw=1.2, zorder=2))
    ax.text(x + 0.12, top - 0.25, name, va="center", fontsize=9.5, fontweight="bold", zorder=3)
    for i, c in enumerate(cols):
        ax.text(x + 0.12, top - 0.5 - ROW * (i + 0.5), c, va="center", fontsize=8.2, zorder=3)
    return {"x": x, "top": top, "bottom": top - h, "w": COL_W, "mid": top - h / 2}


def rel(ax, points, one, many):
    """Línea ortogonal entre tablas con '1' junto a la tabla padre y 'N' junto a la hija."""
    xs, ys = zip(*points)
    ax.plot(xs, ys, color=INK, lw=1.1, zorder=1)
    for (px, py), (qx, qy), text in ((points[0], points[1], one), (points[-1], points[-2], many)):
        dx, dy = qx - px, qy - py
        off = 0.22
        tx = px + (off if dx > 0 else -off if dx < 0 else 0.18)
        ty = py + (off if dy > 0 else -off if dy < 0 else 0.18)
        ax.text(tx, ty, text, fontsize=8.5, fontweight="bold", ha="center", va="center", zorder=4,
                bbox=dict(fc="white", ec="none", pad=0.6))


def base_de_datos():
    fig, ax = plt.subplots(figsize=(16, 8.6))
    ax.set_xlim(0, 24.6)
    ax.set_ylim(2.6, 14.6)
    ax.axis("off")
    t = {n: tabla(ax, n, *v) for n, v in TABLES.items()}

    def right(n, dy=0):
        return (t[n]["x"] + COL_W, t[n]["mid"] + dy)

    def left(n, dy=0):
        return (t[n]["x"], t[n]["mid"] + dy)

    def bottom(n, dx=0):
        return (t[n]["x"] + COL_W / 2 + dx, t[n]["bottom"])

    def top(n, dx=0):
        return (t[n]["x"] + COL_W / 2 + dx, t[n]["top"])

    # Usuarios y roles (N:M mediante role_user).
    rel(ax, [bottom("users"), top("role_user")], "1", "N")
    rel(ax, [top("roles"), bottom("role_user")], "1", "N")
    # Usuario ↔ cliente / personal (1:1).
    rel(ax, [right("users", 0.3), left("clients", 0.3)], "1", "1")
    gap01 = COL_X[1] - 0.6
    rel(ax, [right("users", -0.6), (gap01, t["users"]["mid"] - 0.6), (gap01, t["staff"]["mid"]), left("staff")], "1", "1")
    # Habitaciones.
    rel(ax, [bottom("room_types"), top("rooms")], "1", "N")
    gap23 = COL_X[3] - 0.65
    rel(ax, [right("rooms"), (gap23, t["rooms"]["mid"]), (gap23, t["reservations"]["mid"] - 0.4), left("reservations", -0.4)], "1", "N")
    # Cliente → reservas: pasa por encima de room_types.
    over = ROW_TOP[0] + 0.55
    rel(ax, [top("clients"), (top("clients")[0], over), (top("reservations")[0], over), top("reservations")], "1", "N")
    # Reserva → estadía → cochera.
    rel(ax, [bottom("reservations"), top("stays")], "1", "1")
    rel(ax, [right("stays"), (t["parking_assignments"]["x"], t["stays"]["mid"])], "1", "N")
    rel(ax, [bottom("parking_spots"), top("parking_assignments")], "1", "N")
    # Inventario.
    rel(ax, [right("inventory_items"), left("inventory_movements")], "1", "N")

    ax.text(COL_X[4], 6.3, "Cardinalidad: 1 junto a la tabla padre,\nN junto a la tabla hija.", fontsize=9, va="top")
    ax.text(COL_X[4], 5.4, "audit_logs e inventory_movements\nreferencian a users (→ users).", fontsize=9, va="top", color=MID)
    ax.text(0.3, 2.8, "13 tablas del dominio + tokens de Sanctum. Fuente editable: docs/diagramas/legrandhotel.dbml (dbdiagram.io).",
            fontsize=9, color=MID)
    fig.savefig(OUT / "base-de-datos.png", dpi=200, bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    arquitectura()
    base_de_datos()
    print("Diagramas generados en", OUT)
