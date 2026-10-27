"""
Diagrama de clases UML (uml-clases.png) en escala de grises, a partir de los modelos de api/app/Models.
La fuente editable equivalente está en uml-clases.puml (PlantUML).
Uso: python docs/diagramas/uml.py
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.patches import Rectangle  # noqa: E402

OUT = Path(__file__).resolve().parent
INK, MID = "#111111", "#555555"
W, LINE, HEAD = 7.2, 0.42, 0.85
COL_X = [0.9 + i * 9.1 for i in range(5)]

# nombre: (columna, fila, estereotipo, atributos, métodos)
CLASSES = {
    "User": (0, 0, None, ["+ id: int", "+ name: string", "+ email: string {unique}", "- password: string {bcrypt}",
                          "+ google_id: string [0..1]", "+ email_verified_at: datetime [0..1]"],
             ["+ hasRole(roles): bool", "+ assignRole(name): void", "+ isAdmin(): bool"]),
    "Client": (1, 0, "«guest»", ["+ id: int", "+ document_type: string", "+ document_number: string {unique}",
                                    "+ full_name: string", "+ phone: string [0..1]", "+ nationality: string [0..1]"], []),
    "RoomType": (2, 0, None, ["+ id: int", "+ name: string {unique}", "+ amenities: json [0..1]", "+ capacity: int",
                              "+ price_per_night: decimal"], []),
    "Reservation": (3, 0, None, ["+ id: int", "+ check_in: date", "+ check_out: date", "+ guests: int",
                                 "+ status: string", "+ total: decimal"], ["+ overlapping(from, to): Query"]),
    "ParkingSpot": (4, 0, None, ["+ id: int", "+ code: string {unique}", "+ status: string"], []),
    "Role": (0, 1, None, ["+ id: int", "+ name: string {unique}", "+ label: string"],
             ["ADMIN, RECEPTIONIST,", "STOREKEEPER, DEVELOPER,", "CLIENT"]),
    "Staff": (1, 1, None, ["+ id: int", "+ position: string", "+ shift: string", "+ hired_at: date"], []),
    "Room": (2, 1, None, ["+ id: int", "+ number: string {unique}", "+ floor: int", "+ status: string"],
             ["+ availableBetween(from, to): Query"]),
    "Stay": (3, 1, None, ["+ id: int", "+ checked_in_at: datetime", "+ checked_out_at: datetime [0..1]"], []),
    "ParkingAssignment": (4, 1, None, ["+ id: int", "+ plate: string", "+ entered_at: datetime", "+ left_at: datetime [0..1]"], []),
    "AuditLog": (1, 2, None, ["+ id: int", "+ action: string", "+ entity: string", "+ entity_id: int",
                              "+ changes: json [0..1]", "+ created_at: datetime"], []),
    "InventoryItem": (2, 2, None, ["+ id: int", "+ name: string", "+ unit: string", "+ stock: int", "+ min_stock: int"],
                      ["+ isBelowMinimum(): bool"]),
    "InventoryMovement": (3, 2, None, ["+ id: int", "+ type: string {in | out}", "+ quantity: int", "+ reason: string [0..1]"], []),
}


def height(attrs, methods):
    return HEAD + 0.2 + LINE * len(attrs) + 0.2 + LINE * max(len(methods), 1)


def layout():
    rows = {}
    for name, (col, row, *_rest) in CLASSES.items():
        rows.setdefault(row, []).append(height(*_rest[1:]))
    tops, y = {}, 25.0
    for row in sorted(rows):
        tops[row] = y
        y -= max(rows[row]) + 2.2
    return tops


def draw_class(ax, name, col, row, stereo, attrs, methods, tops):
    x, top = COL_X[col], tops[row]
    h = height(attrs, methods)
    ax.add_patch(Rectangle((x, top - h), W, h, fc="white", ec=INK, lw=1.3, zorder=2))
    # compartimento del nombre
    ax.add_patch(Rectangle((x, top - HEAD), W, HEAD, fc="#e2e2e2", ec=INK, lw=1.3, zorder=2))
    if stereo:
        ax.text(x + W / 2, top - 0.2, stereo, ha="center", va="center", fontsize=9.5, style="italic", zorder=3)
        ax.text(x + W / 2, top - 0.57, name, ha="center", va="center", fontsize=13, fontweight="bold", zorder=3)
    else:
        ax.text(x + W / 2, top - HEAD / 2, name, ha="center", va="center", fontsize=13, fontweight="bold", zorder=3)
    # atributos
    y = top - HEAD - 0.12
    for a in attrs:
        y -= LINE
        ax.text(x + 0.12, y + LINE / 2, a, va="center", fontsize=11, zorder=3)
    sep = y - 0.1
    ax.plot([x, x + W], [sep, sep], color=INK, lw=1.0, zorder=3)
    # métodos (o constantes en Role)
    y = sep - 0.1
    for m in methods:
        y -= LINE
        ax.text(x + 0.12, y + LINE / 2, m, va="center", fontsize=11, zorder=3,
                style="italic" if name == "Role" else "normal")
    return {"x": x, "top": top, "bottom": top - h, "mid": top - h / 2}


def assoc(ax, pts, m1, m2, label=None, label_at=None):
    """Asociación UML: línea con la multiplicidad junto a cada extremo y el nombre en el tramo indicado."""
    xs, ys = zip(*pts)
    ax.plot(xs, ys, color=INK, lw=1.1, zorder=1)
    for (px, py), (qx, qy), text in ((pts[0], pts[1], m1), (pts[-1], pts[-2], m2)):
        dx, dy = qx - px, qy - py
        tx = px + (0.38 if dx > 0 else -0.38 if dx < 0 else 0.3)
        ty = py + (0.28 if dy > 0 else -0.28 if dy < 0 else 0.22)
        ax.text(tx, ty, text, fontsize=11, ha="center", va="center", zorder=4,
                bbox=dict(fc="white", ec="none", pad=0.4))
    if label:
        (ax_, ay), (bx, by) = pts[label_at], pts[label_at + 1]
        ax.text((ax_ + bx) / 2, (ay + by) / 2, label, fontsize=10.5, style="italic", ha="center", va="center",
                zorder=4, bbox=dict(fc="white", ec="none", pad=0.6))


def main():
    tops = layout()
    fig, ax = plt.subplots(figsize=(25, 13.5))
    ax.set_xlim(-0.3, COL_X[4] + W + 0.4)
    ax.axis("off")
    c = {n: draw_class(ax, n, *v, tops) for n, v in CLASSES.items()}

    def right(n, dy=0):
        return (c[n]["x"] + W, c[n]["mid"] + dy)

    def left(n, dy=0):
        return (c[n]["x"], c[n]["mid"] + dy)

    def top(n, dx=0):
        return (c[n]["x"] + W / 2 + dx, c[n]["top"])

    def bottom(n, dx=0):
        return (c[n]["x"] + W / 2 + dx, c[n]["bottom"])

    gap01 = COL_X[1] - 0.85
    gap23 = COL_X[3] - 0.85

    assoc(ax, [bottom("User"), top("Role")], "0..*", "1..*", "has", 0)
    # Cuenta de Google del huésped (rol client) enlazada con su ficha (clients.user_id).
    link_y = c["User"]["top"] + 0.6
    assoc(ax, [top("User"), (top("User")[0], link_y), (c["Client"]["x"] + 1.2, link_y), (c["Client"]["x"] + 1.2, c["Client"]["top"])],
          "0..1", "0..1", "guest account", 1)
    assoc(ax, [right("User", 0.6), (gap01, c["User"]["mid"] + 0.6), (gap01, c["Staff"]["mid"]), left("Staff")], "1", "0..1", "staff record", 1)
    # User → AuditLog e InventoryMovement bajan por el margen izquierdo (la fila 3 de la columna 1 está libre).
    assoc(ax, [left("User", 0.5), (0.45, c["User"]["mid"] + 0.5), (0.45, c["AuditLog"]["mid"]), left("AuditLog")], "0..1", "0..*", "performs", 2)
    low = min(v["bottom"] for v in c.values()) - 0.9
    assoc(ax, [left("User", -0.5), (0.05, c["User"]["mid"] - 0.5), (0.05, low), (bottom("InventoryMovement")[0], low), bottom("InventoryMovement")],
          "0..1", "0..*", "records", 2)
    over = c["Client"]["top"] + 0.95
    assoc(ax, [top("Client"), (top("Client")[0], over), (top("Reservation")[0], over), top("Reservation")], "1", "0..*", "books", 1)
    assoc(ax, [bottom("RoomType"), top("Room")], "1", "0..*", "classifies", 0)
    assoc(ax, [right("Room"), (gap23, c["Room"]["mid"]), (gap23, c["Reservation"]["mid"] - 0.5), left("Reservation", -0.5)], "1", "0..*", "is booked in", 1)
    assoc(ax, [bottom("Reservation"), top("Stay")], "1", "0..1", "creates", 0)
    assoc(ax, [right("Stay"), (c["ParkingAssignment"]["x"], c["Stay"]["mid"])], "0..1", "0..*", "uses", 0)
    assoc(ax, [bottom("ParkingSpot"), top("ParkingAssignment")], "1", "0..*", "occupies", 0)
    assoc(ax, [right("InventoryItem"), (c["InventoryMovement"]["x"], c["InventoryItem"]["mid"])], "1", "0..*", "moves", 0)

    note_x, note_y = COL_X[4], c["ParkingAssignment"]["bottom"] - 1.2
    ax.text(note_x, note_y, "UML notation:\n+ public   - private\n[0..1] optional   {unique} constraint\n1, 0..1, 0..* multiplicity\nRole is linked to User\nthrough the role_user table.",
            fontsize=11, va="top", linespacing=1.5)
    ax.set_ylim(low - 0.8, over + 0.6)
    ax.text(0.05, low - 0.55, "LeGrandHotel class diagram (models in api/app/Models). Editable source: docs/diagramas/uml-clases.puml (PlantUML).",
            fontsize=11, color=MID)
    fig.savefig(OUT / "uml-clases.png", dpi=400, bbox_inches="tight")
    # SVG vectorial para el informe: Word y el PDF lo muestran nítido a cualquier zoom.
    fig.savefig(OUT / "uml-clases.svg", bbox_inches="tight")
    plt.close(fig)
    print("UML generado en", OUT / "uml-clases.png")


if __name__ == "__main__":
    main()
