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
INK, MID, FILL = "#111111", "#555555", "#f1f1f1"


def box(ax, x, y, w, h, title, lines=(), fill="white", lw=1.2, dashed=False):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.08",
                                fc=fill, ec=INK, lw=lw, ls="--" if dashed else "-"))
    ax.text(x + w / 2, y + h - 0.22, title, ha="center", va="top", fontsize=9.5, fontweight="bold")
    for i, line in enumerate(lines):
        ax.text(x + w / 2, y + h - 0.55 - i * 0.27, line, ha="center", va="top", fontsize=8)


def arrow(ax, a, b, label="", style="-|>", dashed=False):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle=style, mutation_scale=12, color=INK, lw=1.1,
                                 ls="--" if dashed else "-", shrinkA=2, shrinkB=2))
    if label:
        ax.text((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.08, label, ha="center", va="bottom", fontsize=7.5,
                bbox=dict(fc="white", ec="none", pad=0.5))


def arquitectura():
    fig, ax = plt.subplots(figsize=(10, 6.6))
    ax.set_xlim(0, 14)
    ax.set_ylim(-0.6, 9.2)
    ax.axis("off")

    box(ax, 0.2, 7.3, 2.2, 1.3, "Usuario", ["Navegador web"])
    box(ax, 3.2, 7.6, 2.6, 1.2, "CloudFront", ["HTTPS · caché"])
    box(ax, 6.6, 7.6, 2.6, 1.2, "S3 (privado)", ["React ofuscado"])
    arrow(ax, (2.4, 8.1), (3.2, 8.2), "sitio web")
    arrow(ax, (5.8, 8.2), (6.6, 8.2))

    # VPC
    ax.add_patch(Rectangle((2.9, 0.3), 8.4, 6.9, fc="white", ec=INK, lw=1.4))
    ax.text(11.15, 7.0, "VPC 10.20.0.0/16 · us-east-1", fontsize=9, fontweight="bold", va="top", ha="right")
    ax.add_patch(Rectangle((3.1, 3.6), 8.0, 3.0, fc=FILL, ec=MID, lw=0.8, ls="--"))
    ax.text(3.25, 6.45, "Subredes públicas (2 zonas)", fontsize=8, va="top", color=MID)
    ax.add_patch(Rectangle((3.1, 0.5), 8.0, 2.8, fc="white", ec=MID, lw=0.8, ls="--"))
    ax.text(3.25, 3.15, "Subredes privadas (2 zonas) · sin acceso desde internet", fontsize=8, va="top", color=MID)

    box(ax, 3.4, 4.0, 2.6, 1.8, "Load Balancer", ["HTTPS 443", "health: /api/v1/health"])
    box(ax, 6.8, 3.9, 4.0, 2.1, "EC2 Auto Scaling (1–3)", ["Docker: Nginx + PHP-FPM", "Laravel 12 · worker · scheduler", "t3.small"])
    arrow(ax, (1.3, 7.3), (3.4, 4.9))
    ax.text(1.0, 6.0, "API (HTTPS)", fontsize=7.5, ha="center")
    arrow(ax, (6.0, 4.9), (6.8, 4.9), "solo desde ALB")

    box(ax, 3.6, 0.8, 3.2, 1.9, "RDS MySQL 8", ["cifrada", "snapshots 7 días"])
    box(ax, 7.6, 0.8, 3.2, 1.9, "ElastiCache Redis", ["caché · colas", "rate limit"], dashed=True)
    arrow(ax, (7.8, 3.9), (5.6, 2.7), "3306")
    arrow(ax, (9.0, 3.9), (9.1, 2.7), "6379")

    box(ax, 11.7, 5.6, 2.1, 1.3, "SSM", ["secretos"])
    box(ax, 11.7, 3.9, 2.1, 1.3, "CloudWatch", ["logs JSON", "alarmas"])
    box(ax, 11.7, 2.2, 2.1, 1.3, "S3 respaldos", ["mysqldump diario"])
    box(ax, 11.7, 7.6, 2.1, 1.2, "GitHub Actions", ["CI/CD · OIDC"], dashed=True)
    arrow(ax, (10.8, 5.6), (11.7, 6.2))
    arrow(ax, (10.8, 4.6), (11.7, 4.6))
    arrow(ax, (10.8, 4.1), (11.7, 2.9))
    arrow(ax, (11.7, 8.0), (10.3, 6.0), dashed=True)
    ax.text(11.0, 7.35, "despliega", fontsize=7.5, ha="left")

    ax.text(0.2, -0.4, "Línea discontinua: componentes de entregas posteriores (Redis: 80%, CI/CD: 100%).", fontsize=7.5, color=MID)
    fig.savefig(OUT / "arquitectura.png", dpi=200, bbox_inches="tight")
    plt.close(fig)


TABLES = {
    "users": (0.3, 6.6, ["id", "name", "email (único)", "password (bcrypt)", "google_id", "email_verified_at"]),
    "role_user": (0.3, 3.9, ["user_id → users", "role_id → roles"]),
    "roles": (0.3, 2.3, ["id", "name (único)", "label"]),
    "clients": (3.6, 6.6, ["id", "user_id → users", "document_number (único)", "full_name", "phone", "nationality"]),
    "staff": (3.6, 3.9, ["id", "user_id → users", "position", "shift", "hired_at"]),
    "room_types": (6.9, 6.6, ["id", "name (único)", "capacity", "price_per_night"]),
    "rooms": (6.9, 3.9, ["id", "room_type_id → room_types", "number (único)", "floor", "status (índice)"]),
    "reservations": (10.2, 6.6, ["id", "client_id → clients", "room_id → rooms", "check_in, check_out (índice)", "status", "total"]),
    "stays": (10.2, 3.9, ["id", "reservation_id → reservations", "checked_in_at", "checked_out_at"]),
    "parking_spots": (13.5, 6.6, ["id", "code (único)", "status"]),
    "parking_assignments": (13.5, 3.9, ["id", "parking_spot_id → spots", "stay_id → stays", "plate", "entered_at, left_at"]),
    "inventory_items": (6.9, 1.0, ["id", "name (índice)", "unit", "stock", "min_stock"]),
    "inventory_movements": (10.2, 1.0, ["id", "inventory_item_id → items", "user_id → users", "type (in/out)", "quantity"]),
    "audit_logs": (3.6, 1.0, ["id", "user_id → users", "action", "entity", "created_at"]),
}


def tabla(ax, name, x, y, cols):
    w, row = 3.0, 0.3
    h = 0.42 + row * len(cols)
    ax.add_patch(Rectangle((x, y - h), w, h, fc="white", ec=INK, lw=1.1))
    ax.add_patch(Rectangle((x, y - 0.42), w, 0.42, fc="#dddddd", ec=INK, lw=1.1))
    ax.text(x + 0.1, y - 0.21, name, va="center", fontsize=8.5, fontweight="bold")
    for i, c in enumerate(cols):
        ax.text(x + 0.1, y - 0.42 - row * (i + 0.5), c, va="center", fontsize=7.2)
    return (x, y - h, w, h)


def base_de_datos():
    fig, ax = plt.subplots(figsize=(13, 6.8))
    ax.set_xlim(0, 16.8)
    ax.set_ylim(-1.7, 6.9)
    ax.axis("off")
    pos = {n: tabla(ax, n, *TABLES[n]) for n in TABLES}

    def link(a, b, label):
        ax_, ay, aw, ah = pos[a]
        bx, by, bw, bh = pos[b]
        p1 = (ax_ + aw / 2, ay + ah / 2)
        p2 = (bx + bw / 2, by + bh / 2)
        ax.add_patch(FancyArrowPatch(p1, p2, arrowstyle="-", color=MID, lw=0.8, ls=":", zorder=0))
        ax.text((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, label, fontsize=7, ha="center", va="center",
                bbox=dict(fc="white", ec="none", pad=0.3), zorder=1)

    link("users", "role_user", "N:M")
    link("roles", "role_user", "")
    link("users", "clients", "1:1")
    link("users", "staff", "1:1")
    link("room_types", "rooms", "1:N")
    link("clients", "reservations", "1:N")
    link("rooms", "reservations", "1:N")
    link("reservations", "stays", "1:1")
    link("parking_spots", "parking_assignments", "1:N")
    link("stays", "parking_assignments", "1:N")
    link("inventory_items", "inventory_movements", "1:N")
    ax.text(0.3, -1.5, "13 tablas del dominio + tokens de Sanctum. Fuente editable: docs/diagramas/legrandhotel.dbml (dbdiagram.io).",
            fontsize=8, color=MID)
    fig.savefig(OUT / "base-de-datos.png", dpi=200, bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    arquitectura()
    base_de_datos()
    print("Diagramas generados en", OUT)
