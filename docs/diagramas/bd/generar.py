"""
Diagrama entidad-relación de la base MySQL `legrandhotel`, generado desde el esquema real.

1. Exporta el esquema desde MySQL (ver README.md: columnas.tsv, claves-foraneas.tsv, indices.tsv).
2. python docs/diagramas/bd/generar.py   → escribe diagrama.mmd (Mermaid erDiagram)
3. GitHub dibuja el .mmd solo; la versión para imprimir la hace dibujar.py.

Notación (pata de gallo): || exactamente uno · |o cero o uno · o{ cero o muchos.
Línea continua = clave foránea real en MySQL; línea punteada = relación que Laravel maneja sin clave foránea.
"""
import csv
from collections import defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent

# Tablas de Laravel sin relación con el negocio: se listan aparte, no en el dibujo.
INTERNAS = {"cache", "cache_locks", "jobs", "job_batches", "failed_jobs", "migrations", "password_reset_tokens"}

# Relaciones sin clave foránea (las resuelve Laravel): tabla, columna, tabla padre, etiqueta.
LOGICAS = [
    ("personal_access_tokens", "tokenable_id", "users", "tokenable_id (polimórfica, sin FK)"),
    ("sessions", "user_id", "users", "user_id (sin FK)"),
]


def leer(nombre):
    with open(BASE / nombre, encoding="utf-8", newline="") as f:
        return [fila for fila in csv.reader(f, delimiter="\t") if fila]


columnas = defaultdict(list)
for tabla, _pos, col, tipo, nulo, clave, _default, _extra in leer("columnas.tsv"):
    columnas[tabla].append((col, tipo, nulo == "YES", clave))

fks = leer("claves-foraneas.tsv")  # tabla, columna, tabla_ref, columna_ref, on_delete, nombre
unicos = {(t, cols) for t, _n, no_unico, cols in leer("indices.tsv") if no_unico == "0"}
fk_cols = {(t, c) for t, c, *_ in fks} | {(t, c) for t, c, *_ in LOGICAS}


def tipo_mermaid(tipo):
    # Mermaid no admite comas ni espacios en el tipo: decimal(10,2) → decimal(10-2), bigint unsigned → bigint_unsigned.
    return tipo.replace(",", "-").replace(" ", "_")


lineas = ["erDiagram"]
for tabla in sorted(columnas):
    if tabla in INTERNAS:
        continue
    lineas.append(f"    {tabla} {{")
    for col, tipo, nulo, clave in columnas[tabla]:
        marcas = []
        if clave == "PRI":
            marcas.append("PK")
        if (tabla, col) in fk_cols:
            marcas.append("FK")
        if (tabla, col) in unicos and clave != "PRI":
            marcas.append("UK")
        comentario = ' "NULL"' if nulo else ""
        lineas.append(f"        {tipo_mermaid(tipo)} {col} {','.join(marcas)}{comentario}".rstrip())
    lineas.append("    }")

for tabla, col, padre, _col_ref, on_delete, _nombre in fks:
    nulo = next(n for c, _t, n, _k in columnas[tabla] if c == col)
    lado_padre = "|o" if nulo else "||"           # FK opcional: el hijo puede no tener padre
    lado_hijo = "o|" if (tabla, col) in unicos else "o{"  # FK única: relación uno a uno
    lineas.append(f'    {padre} {lado_padre}--{lado_hijo} {tabla} : "{col} · ON DELETE {on_delete}"')

for tabla, col, padre, etiqueta in LOGICAS:
    lineas.append(f'    {padre} |o..o{{ {tabla} : "{etiqueta}"')

(BASE / "diagrama.mmd").write_text("\n".join(lineas) + "\n", encoding="utf-8")
print(f"{len([t for t in columnas if t not in INTERNAS])} tablas, {len(fks)} claves foráneas, {len(LOGICAS)} relaciones lógicas")
print("Internas de Laravel (aparte):", ", ".join(sorted(INTERNAS & set(columnas))))
