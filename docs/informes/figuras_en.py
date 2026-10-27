"""
Genera en inglés las figuras del informe (docs/informes/figuras-en/) sin tocar las originales en español.
Reutiliza los scripts de diagramas, gráficos k6 y bocetos móviles: traduce cada texto al dibujarlo
(diccionario EN) y redirige los PNG a figuras-en/.

Uso:  python docs/informes/figuras_en.py            (genera las figuras)
      python docs/informes/figuras_en.py --listar   (lista los textos sin traducir)
"""
import importlib.util
import re
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
from matplotlib.figure import Figure  # noqa: E402
from matplotlib.text import Text  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/informes/figuras-en"
LISTAR = "--listar" in sys.argv

EN = {
    '(ALB → EC2 → Laravel)': '(ALB → EC2 → Laravel)',
    '1. Login (personal)': '1. Login (staff)',
    '2. Hoy (recepción)': '2. Today (front desk)',
    '3. Nueva reserva (recepción)': '3. New booking (front desk)',
    '4. Habitaciones (recepción)': '4. Rooms (front desk)',
    '5. Inventario (almacén)': '5. Inventory (storeroom)',
    '8 habitaciones disponibles': '8 rooms available',
    'API LeGrandHotel': 'LeGrandHotel API',
    'Alertas': 'Alerts',
    'Almacenamiento seguro': 'Secure storage',
    'Axios (mismo interceptor de la web)': 'Axios (same interceptor as the web)',
    'Base de datos': 'Database',
    'Buscar insumo': 'Search supply',
    'Cochera': 'Parking',
    'Continuar con Google': 'Continue with Google',
    'Contraseña': 'Password',
    'Correo': 'Email',
    'Crear reserva': 'Create booking',
    'Cuentas: las crea el admin.': 'Accounts are created by the admin.',
    'Doble · 203': 'Double · 203',
    'Entrada': 'In',
    'Entrar': 'Sign in',
    'Evolución durante la corrida de 50 usuarios virtuales': 'Behaviour during the 50 virtual users run',
    'Habit.': 'Rooms',
    'Habitaciones': 'Rooms',
    'Hoy': 'Today',
    'Hoy en recepción': 'Front desk today',
    'Huella / Face ID': 'Fingerprint / Face ID',
    'Huésped (nombre o DNI)': 'Guest (name or ID)',
    'Ingresar': 'Sign in',
    'Iniciar sesión': 'Sign in',
    'Insumos': 'Supplies',
    'Inventario': 'Inventory',
    'Jabón de tocador': 'Hand soap',
    'Lecturas': 'Reads',
    'Libre': 'Free',
    'Libres': 'Free',
    'Limpieza': 'Cleaning',
    'Llegadas': 'Arrivals',
    'Llegan': 'Arriving',
    'Luis Pérez · DNI 40404040': 'Luis Pérez · ID 40404040',
    'Límite: 1%': 'Limit: 1%',
    'Línea discontinua: componentes de entregas posteriores (Redis en el 80%, CI/CD en el 100%).': 'Dashed line: components of later deliveries (Redis at 80%, CI/CD at 100%).',
    'Línea discontinua: funciones de las entregas del 80% y 100% (notificaciones, desbloqueo biométrico).': 'Dashed line: features of the 80% and 100% deliveries (notifications, biometric unlock).',
    'Mant.': 'Maint.',
    'Matrimonial · 301': 'Queen · 301',
    'Mediana (p50)': 'Median (p50)',
    'Mediana por segundo': 'Median per second',
    'Meta: p95 < 500 ms': 'Target: p95 < 500 ms',
    'Movimiento': 'Movement',
    'Navegador web': 'Web browser',
    'Nueva reserva': 'New booking',
    'Ocupada': 'Occupied',
    'Perfil': 'Profile',
    'Peticiones atendidas por segundo': 'Requests served per second',
    'Peticiones fallidas (%)': 'Failed requests (%)',
    'Peticiones por segundo': 'Requests per second',
    'React ofuscado': 'Obfuscated React',
    'Registrar movimiento': 'Record movement',
    'Registrar · S/ 1 350.00': 'Book · S/ 1,350.00',
    'Reponer': 'Restock',
    'Reservar': 'Book',
    'S/ 180 / noche': 'S/ 180 / night',
    'S/ 220 / noche': 'S/ 220 / night',
    'S/ 450 / noche': 'S/ 450 / night',
    'S3 (privado)': 'S3 (private)',
    'S3 respaldos': 'S3 backups',
    'Salen': 'Leaving',
    'Salida': 'Out',
    'Segundos desde el inicio': 'Seconds since start',
    'Solo personal del hotel.': 'Hotel staff only.',
    'Subredes privadas (2 zonas)': 'Private subnets (2 zones)',
    'Subredes públicas (2 zonas)': 'Public subnets (2 zones)',
    'Sábanas 1.5 plazas': 'Full-size sheets',
    'Tasa de errores según la carga': 'Error rate by load',
    'Teléfono (Android / iOS)': 'Phone (Android / iOS)',
    'Tiempo de respuesta (ms)': 'Response time (ms)',
    'Tiempo de respuesta según la carga': 'Response time by load',
    'Toallas': 'Towels',
    'Usar huella / Face ID': 'Use fingerprint / Face ID',
    'Usuario': 'User',
    'Usuarios virtuales simultáneos': 'Concurrent virtual users',
    'VU activos': 'Active VUs',
    'alarmas': 'alarms',
    'aviso (cola)': 'notice (queue)',
    'caché · colas': 'cache · queues',
    'cifrada': 'encrypted',
    'desbloqueo opcional': 'optional unlock',
    'despliega': 'deploys',
    'formato JSON único': 'single JSON format',
    'la misma de la web: /api/v1': 'same as the web: /api/v1',
    'mysqldump diario': 'daily mysqldump',
    'notificaciones': 'service',
    'notificación al teléfono': 'notification to the phone',
    'o': 'or',
    'p95 por segundo': 'p95 per second',
    'p95 por tipo de operación': 'p95 by operation type',
    'secretos': 'secrets',
    'servicio de': 'push notification',
    'sin acceso desde internet': 'no internet access',
    'sitio web': 'website',
    'snapshots 7 días': '7-day snapshots',
    'solo ALB': 'ALB only',
    'subred privada': 'private subnet',
    'toalla': 'towel',
    'token Bearer de 60 min': '60-min Bearer token',
    'worker de colas · scheduler': 'queue worker · scheduler',
    'HTTPS · caché': 'HTTPS · cache',
    'logs JSON': 'JSON logs',
    '/api/v1/health': '/api/v1/health',
    'API (HTTPS)': 'API (HTTPS)',
    'App LeGrandHotel': 'App LeGrandHotel',
    'Apple (iOS)': 'Apple (iOS)',
    'CI/CD · OIDC': 'CI/CD · OIDC',
    'Check-in': 'Check-in',
    'CloudFront': 'CloudFront',
    'CloudWatch': 'CloudWatch',
    'Docker: Nginx + PHP-FPM': 'Docker: Nginx + PHP-FPM',
    'EC2 · Auto Scaling 1–3': 'EC2 · Auto Scaling 1–3',
    'ElastiCache': 'ElastiCache',
    'Expo Push': 'Expo Push',
    'Expo Router · TanStack Query': 'Expo Router · TanStack Query',
    'FCM / APNs': 'FCM / APNs',
    'Gabriela B.': 'Gabriela B.',
    'GitHub Actions': 'GitHub Actions',
    'Google (Android)': 'Google (Android)',
    'HTTPS + token': 'HTTPS + token',
    'HTTPS 443': 'HTTPS 443',
    'JSON': 'JSON',
    'Juan Cerda': 'Juan Cerda',
    'Keychain (iOS) · Keystore (Android)': 'Keychain (iOS) · Keystore (Android)',
    'L': 'L',
    'Laravel 12': 'Laravel 12',
    'LeGrandHotel': 'LeGrandHotel',
    'Load Balancer': 'Load Balancer',
    'Login': 'Login',
    'Mateo Arroyo': 'Mateo Arroyo',
    'RDS MySQL 8': 'RDS MySQL 8',
    'React Native + Expo': 'React Native + Expo',
    'Redis': 'Redis',
    'SSM': 'SSM',
    'Sanctum · roles · rate limits': 'Sanctum · roles · rate limits',
    'Shampoo': 'Shampoo',
    'Suite · 405': 'Suite · 405',
    'VPC 10.20.0.0/16 · us-east-1': 'VPC 10.20.0.0/16 · us-east-1',
    'Valentín G.': 'Valentín G.',
    'health check:': 'health check:',
    'ms': 'ms',
    'p90': 'p90',
    'p95': 'p95',
    'p95 (ms)': 'p95 (ms)',
    'rosa@legrandhotel.pe': 'rosa@legrandhotel.pe',
    't3.small': 't3.small',
}
# Textos con números variables: (patrón, reemplazo).
EN_RE = [
    (r'(\d+) de mín\. (\d+)', r'\1 of min. \2'),
    (r'Hab\. (\d+)', r'Room \1'),
    (r'Piso (\d+)', r'Floor \1'),
    (r'(p95 \d+ ms)', r'\1'),
]

pending = set()
_set_text = Text.set_text


def translate(s):
    if not isinstance(s, str) or not s.strip():
        return s
    if s in EN:
        return EN[s]
    for pattern, repl in EN_RE:
        if re.fullmatch(pattern, s, flags=re.S):
            return re.sub(pattern, repl, s, flags=re.S)
    if re.search(r"[A-Za-zÁÉÍÓÚáéíóúñÑ]", s):
        pending.add(s)
    return s


def set_text(self, s):
    return _set_text(self, translate(s) if isinstance(s, str) else s)


_savefig = Figure.savefig


def savefig(self, fname, *args, **kwargs):
    # El nombre lleva la carpeta de origen: diagramas/ y movil/ tienen ambos un arquitectura.png.
    path = Path(fname)
    return _savefig(self, OUT / f"{path.parent.name}-{path.name}", *args, **kwargs)


Text.set_text = set_text
Figure.savefig = savefig


def load(rel):
    path = ROOT / rel
    spec = importlib.util.spec_from_file_location(path.stem + "_en", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    OUT.mkdir(exist_ok=True)
    load("docs/diagramas/diagramas.py").arquitectura()
    charts = load("docs/pruebas/graficos.py")
    runs = charts.load_runs()
    charts.chart_latency(runs)
    charts.chart_throughput(runs)
    charts.chart_errors(runs)
    charts.chart_by_type(runs)
    charts.chart_timeline(max(r["vus"] for r in runs))
    mobile = load("docs/movil/bocetos.py")
    mobile.pantallas()
    mobile.arquitectura()
    if pending:
        print("Sin traducir:" if LISTAR else "AVISO, textos sin traducir:")
        for s in sorted(pending):
            print(repr(s))
    if not LISTAR:
        print("Figuras en inglés generadas en", OUT)


if __name__ == "__main__":
    main()
