"""
Bocetos (wireframes) de la app móvil y diagrama de su arquitectura, en escala de grises.
  pantallas.png     — 5 pantallas principales
  arquitectura.png  — app ↔ API ↔ notificaciones
Uso: python docs/movil/bocetos.py
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle  # noqa: E402

OUT = Path(__file__).resolve().parent
INK, MID, LIGHT, FILL = "#111111", "#666666", "#bdbdbd", "#ececec"
W, H = 3.0, 6.1  # tamaño de cada teléfono
FS = 1.15  # escala de letra (el boceto se imprime reducido en el informe)


def rbox(ax, x, y, w, h, fc="white", ec=INK, lw=1.0, r=0.08, ls="-", z=2):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={r}", fc=fc, ec=ec, lw=lw, ls=ls, zorder=z))


def txt(ax, x, y, s, size=7.5, weight="normal", color=INK, ha="left", va="center", z=4):
    ax.text(x, y, s, fontsize=size * FS, fontweight=weight, color=color, ha=ha, va=va, zorder=z)


def phone(ax, x, title, tabs, active):
    rbox(ax, x, 0, W, H, fc="white", lw=1.8, r=0.3)
    rbox(ax, x + W / 2 - 0.35, H - 0.2, 0.7, 0.08, fc=INK, ec=INK, r=0.04)  # bocina
    txt(ax, x + 0.2, H - 0.42, "9:41", 6.5, color=MID)
    txt(ax, x + 0.2, H - 0.78, title, 10, "bold")
    # barra de pestañas
    ax.plot([x + 0.05, x + W - 0.05], [0.62, 0.62], color=LIGHT, lw=0.8, zorder=3)
    step = W / len(tabs)
    for i, tab in enumerate(tabs):
        cx = x + step * (i + 0.5)
        rbox(ax, cx - 0.12, 0.33, 0.24, 0.17, fc=INK if i == active else "white", ec=INK, lw=0.8, r=0.04)
        txt(ax, cx, 0.18, tab, 5.6, "bold" if i == active else "normal", ha="center")
    return x + 0.2, H - 1.1  # origen del contenido


def field(ax, x, y, label, value="", w=W - 0.4):
    txt(ax, x, y, label, 6.2, color=MID)
    rbox(ax, x, y - 0.42, w, 0.3, r=0.05, lw=0.8)
    if value:
        txt(ax, x + 0.08, y - 0.27, value, 6.5)


def button(ax, x, y, label, w=W - 0.4, primary=True):
    rbox(ax, x, y, w, 0.34, fc=INK if primary else "white", r=0.06, lw=1)
    txt(ax, x + w / 2, y + 0.17, label, 7, "bold", "white" if primary else INK, ha="center")


def pantallas():
    fig, ax = plt.subplots(figsize=(16, 6.9))
    gap = 0.55
    xs = [i * (W + gap) for i in range(5)]
    ax.set_xlim(-0.2, xs[-1] + W + 0.2)
    ax.set_ylim(-0.75, H + 0.15)
    ax.axis("off")

    # 1. Login
    x0, y = phone(ax, xs[0], "Iniciar sesión", ["Entrar", "Registro"], 0)
    rbox(ax, x0, y - 0.55, 0.45, 0.45, fc=INK, r=0.08)
    txt(ax, x0 + 0.225, y - 0.33, "L", 11, "bold", "white", ha="center")
    txt(ax, x0 + 0.6, y - 0.33, "LeGrandHotel", 9, "bold")
    field(ax, x0, y - 0.95, "Correo", "ana@correo.pe")
    field(ax, x0, y - 1.65, "Contraseña", "••••••••")
    button(ax, x0, y - 2.55, "Ingresar")
    txt(ax, x0 + (W - 0.4) / 2, y - 2.8, "o", 6.5, color=MID, ha="center")
    button(ax, x0, y - 3.3, "Continuar con Google", primary=False)
    txt(ax, x0, y - 3.7, "Usar huella / Face ID", 6.5, color=MID)
    txt(ax, x0, y - 4.05, "¿No tienes cuenta? Crear cuenta", 6.5, color=MID)

    # 2. Inicio del cliente
    x0, y = phone(ax, xs[1], "Hola, Ana", ["Inicio", "Reservar", "Mis res.", "Perfil"], 0)
    txt(ax, x0, y - 0.15, "Tu próxima estadía", 7, color=MID)
    rbox(ax, x0, y - 1.65, W - 0.4, 1.35, fc=FILL, r=0.08, lw=1)
    txt(ax, x0 + 0.12, y - 0.55, "Suite · Hab. 405", 8.5, "bold")
    txt(ax, x0 + 0.12, y - 0.85, "12 nov → 15 nov · 3 noches", 6.8)
    txt(ax, x0 + 0.12, y - 1.12, "Total S/ 1 350.00", 6.8)
    rbox(ax, x0 + 0.12, y - 1.54, 1.15, 0.28, fc="white", r=0.1, lw=0.8)
    txt(ax, x0 + 0.695, y - 1.4, "Confirmada", 6, "bold", ha="center")
    button(ax, x0, y - 2.2, "Reservar habitación")
    txt(ax, x0, y - 2.55, "Notificaciones", 7, color=MID)
    for i, line in enumerate(["Reserva confirmada · hace 2 h", "Check-in desde las 14:00"]):
        ax.plot([x0, x0 + W - 0.4], [y - 2.72 - i * 0.45, y - 2.72 - i * 0.45], color=LIGHT, lw=0.7)
        txt(ax, x0, y - 2.95 - i * 0.45, line, 6.5)

    # 3. Reservar
    x0, y = phone(ax, xs[2], "Reservar", ["Inicio", "Reservar", "Mis res.", "Perfil"], 1)
    field(ax, x0, y - 0.1, "Entrada", "12/11/2026", w=(W - 0.5) / 2)
    field(ax, x0 + (W - 0.3) / 2, y - 0.1, "Salida", "15/11/2026", w=(W - 0.5) / 2)
    field(ax, x0, y - 0.8, "Huéspedes", "2")
    txt(ax, x0, y - 1.45, "8 habitaciones disponibles", 6.8, color=MID)
    for i, (name, price) in enumerate([("Doble · 203", "S/ 180 / noche"), ("Matrimonial · 301", "S/ 220 / noche"), ("Suite · 405", "S/ 450 / noche")]):
        yy = y - 1.75 - i * 0.72
        rbox(ax, x0, yy - 0.58, W - 0.4, 0.58, fc=FILL if i == 2 else "white", r=0.06, lw=1.2 if i == 2 else 0.8)
        txt(ax, x0 + 0.12, yy - 0.2, name, 7.2, "bold")
        txt(ax, x0 + 0.12, yy - 0.42, price, 6.3, color=MID)
    button(ax, x0, y - 4.2, "Confirmar · S/ 1 350.00")

    # 4. Recepción — Hoy
    x0, y = phone(ax, xs[3], "Hoy en recepción", ["Hoy", "Habit.", "Cochera", "Perfil"], 0)
    for i, (k, v) in enumerate([("Llegan", "9"), ("Salen", "4"), ("Libres", "12")]):
        cx = x0 + i * ((W - 0.4) / 3)
        rbox(ax, cx, y - 0.75, (W - 0.4) / 3 - 0.08, 0.6, r=0.06, lw=0.8)
        txt(ax, cx + 0.1, y - 0.32, k, 6, color=MID)
        txt(ax, cx + 0.1, y - 0.58, v, 10, "bold")
    txt(ax, x0, y - 1.05, "Llegadas", 7, "bold")
    for i, (name, room) in enumerate([("Mateo Arroyo", "Hab. 1034"), ("Gabriela B.", "Hab. 1022"), ("Juan Cerda", "Hab. 1024"), ("Valentín G.", "Hab. 1013")]):
        yy = y - 1.35 - i * 0.62
        ax.plot([x0, x0 + W - 0.4], [yy + 0.2, yy + 0.2], color=LIGHT, lw=0.7)
        txt(ax, x0, yy, name, 7, "bold")
        txt(ax, x0, yy - 0.22, room, 6, color=MID)
        rbox(ax, x0 + W - 1.2, yy - 0.2, 0.8, 0.3, r=0.05, lw=0.9)
        txt(ax, x0 + W - 0.8, yy - 0.05, "Check-in", 6, "bold", ha="center")

    # 5. Habitaciones (rack)
    x0, y = phone(ax, xs[4], "Habitaciones", ["Hoy", "Habit.", "Cochera", "Perfil"], 1)
    states = [["L", "O", "O", "Li"], ["O", "L", "M", "L"], ["Li", "O", "L", "O"], ["L", "L", "O", "L"]]
    style = {"L": ("white", "Libre"), "O": (INK, "Ocupada"), "Li": (LIGHT, "Limpieza"), "M": (FILL, "Mant.")}
    for r_, row in enumerate(states):
        txt(ax, x0, y - 0.25 - r_ * 0.78, f"Piso {4 - r_}", 6, color=MID)
        for c_, st in enumerate(row):
            cx = x0 + c_ * 0.66
            cy = y - 0.75 - r_ * 0.78
            fc = style[st][0]
            rbox(ax, cx, cy, 0.58, 0.44, fc=fc, r=0.05, lw=0.8, ls="--" if st == "M" else "-")
            txt(ax, cx + 0.29, cy + 0.22, f"{4 - r_}0{c_ + 1}", 6.5, "bold", "white" if st == "O" else INK, ha="center")
    for i, key in enumerate(["L", "O", "Li", "M"]):
        cx = x0 + (i % 2) * 1.3
        cy = y - 3.95 - (i // 2) * 0.3
        rbox(ax, cx, cy - 0.08, 0.18, 0.16, fc=style[key][0], r=0.02, lw=0.7, ls="--" if key == "M" else "-")
        txt(ax, cx + 0.26, cy, style[key][1], 6)

    labels = ["1. Login (todos)", "2. Inicio del cliente", "3. Reservar (cliente)", "4. Hoy (recepción)", "5. Habitaciones (recepción)"]
    for x, label in zip(xs, labels):
        txt(ax, x + W / 2, -0.4, label, 9, "bold", ha="center")
    fig.savefig(OUT / "pantallas.png", dpi=200, bbox_inches="tight")
    plt.close(fig)


def box(ax, x, y, w, h, title, lines=(), dashed=False):
    rbox(ax, x, y, w, h, r=0.12, lw=1.3, ls="--" if dashed else "-")
    txt(ax, x + w / 2, y + h - 0.3, title, 10, "bold", ha="center", va="top")
    for i, line in enumerate(lines):
        txt(ax, x + w / 2, y + h - 0.75 - i * 0.34, line, 8.5, ha="center", va="top")


def arrow(ax, a, b, label="", dashed=False, dy=0.22):
    ax.add_patch(FancyArrowPatch(a, b, arrowstyle="-|>", mutation_scale=13, color=INK, lw=1.2, ls="--" if dashed else "-", zorder=1))
    if label:
        ax.text((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + dy, label, ha="center", va="center", fontsize=8.5,
                bbox=dict(fc="white", ec="none", pad=1.2), zorder=4)


def arquitectura():
    fig, ax = plt.subplots(figsize=(12, 5.6))
    ax.set_xlim(0, 20)
    ax.set_ylim(0, 9.4)
    ax.axis("off")

    ax.add_patch(Rectangle((0.3, 0.6), 6.4, 8.4, fc="white", ec=MID, lw=0.9, ls="--"))
    txt(ax, 0.5, 8.7, "Teléfono (Android / iOS)", 9, color=MID)
    box(ax, 0.8, 5.4, 5.4, 2.9, "App LeGrandHotel", ["React Native + Expo", "Expo Router · TanStack Query", "Axios (mismo interceptor de la web)"])
    box(ax, 0.8, 3.0, 5.4, 1.8, "Almacenamiento seguro", ["Keychain (iOS) · Keystore (Android)", "token Bearer de 60 min"])
    box(ax, 0.8, 0.9, 5.4, 1.6, "Huella / Face ID", ["desbloqueo opcional"], dashed=True)
    arrow(ax, (3.5, 5.4), (3.5, 4.8))

    box(ax, 9.0, 5.0, 5.2, 3.3, "API LeGrandHotel", ["la misma de la web: /api/v1", "Sanctum · roles · rate limits", "formato JSON único", "(ALB → EC2 → Laravel)"])
    box(ax, 9.0, 1.2, 5.2, 2.4, "Base de datos", ["RDS MySQL 8", "subred privada"])
    arrow(ax, (6.2, 7.2), (9.0, 7.2), "HTTPS + token")
    arrow(ax, (9.0, 6.0), (6.2, 6.0), "JSON")
    arrow(ax, (11.6, 5.0), (11.6, 3.6))

    box(ax, 16.0, 5.6, 3.6, 2.5, "Expo Push", ["servicio de", "notificaciones"], dashed=True)
    box(ax, 16.0, 1.6, 3.6, 2.6, "FCM / APNs", ["Google (Android)", "Apple (iOS)"], dashed=True)
    arrow(ax, (14.2, 6.85), (16.0, 6.85), "aviso (cola)", dashed=True)
    arrow(ax, (17.8, 5.6), (17.8, 4.2), dashed=True)
    # FCM/APNs entrega la notificación a la app: baja, pasa por debajo de la BD y sube al teléfono.
    ax.plot([17.8, 17.8, 7.4, 7.4], [1.6, 0.85, 0.85, 5.75], color=INK, lw=1.2, ls="--", zorder=1)
    arrow(ax, (7.4, 5.75), (6.2, 5.75), dashed=True)
    txt(ax, 12.5, 0.85, "notificación al teléfono", 8.5, ha="center", z=5)
    ax.texts[-1].set_bbox(dict(fc="white", ec="none", pad=1.2))

    txt(ax, 0.3, 0.15, "Línea discontinua: funciones de las entregas del 80% y 100% (notificaciones, desbloqueo biométrico).", 8.5, color=MID)
    fig.savefig(OUT / "arquitectura.png", dpi=200, bbox_inches="tight")
    plt.close(fig)


if __name__ == "__main__":
    pantallas()
    arquitectura()
    print("Bocetos generados en", OUT)
