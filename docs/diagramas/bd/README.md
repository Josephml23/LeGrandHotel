# Diagrama de la base de datos

`diagrama-bd.svg` / `.pdf` / `.png`: diagrama entidad-relación (pata de gallo) de la base MySQL `legrandhotel`,
dibujado **desde el esquema real** (no a mano): tablas, columnas, tipos, nulos, PK/FK/UK y la regla `ON DELETE`
de cada clave foránea. `diagrama.mmd` es lo mismo en Mermaid (GitHub lo dibuja solo).

| Archivo | Qué es |
| --- | --- |
| `columnas.tsv`, `claves-foraneas.tsv`, `indices.tsv` | Esquema exportado de `information_schema` |
| `dibujar.py` | Dibuja `diagrama-bd.*` (matplotlib), agrupado por área |
| `generar.py` | Escribe `diagrama.mmd` (Mermaid `erDiagram`) |

## Regenerarlo después de una migración

Con MySQL encendido (`docker compose up -d mysql`), desde la carpeta del proyecto en Git Bash:

```bash
q() { docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --default-character-set=utf8mb4 -N -B -u legrandhotel legrandhotel' <<< "$1"; }
q "SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, IFNULL(COLUMN_DEFAULT,'∅'), EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='legrandhotel' ORDER BY TABLE_NAME, ORDINAL_POSITION;" > docs/diagramas/bd/columnas.tsv
q "SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME, r.DELETE_RULE, k.CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA WHERE k.TABLE_SCHEMA='legrandhotel' AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY 1,2;" > docs/diagramas/bd/claves-foraneas.tsv
q "SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='legrandhotel' GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE ORDER BY 1,2;" > docs/diagramas/bd/indices.tsv
python docs/diagramas/bd/generar.py && python docs/diagramas/bd/dibujar.py
```

Si aparece una tabla nueva, `dibujar.py` se detiene y pide darle una posición en `POS`.
