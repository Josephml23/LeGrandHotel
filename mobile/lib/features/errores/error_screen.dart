import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';

enum ErrorKind { offline, session, forbidden, rateLimited, server, unavailable }

/// Textos y datos de cada pantalla de error.
class _Spec {
  const _Spec(this.icon, this.title, this.body, this.action);
  final IconData icon;
  final String title;
  final String body;
  final String action;
}

const _specs = {
  ErrorKind.offline: _Spec(Icons.wifi_off, 'Sin conexión', 'No hay conexión a internet. Revisa tu red e inténtalo de nuevo.', 'Reintentar'),
  ErrorKind.session: _Spec(Icons.lock_clock, 'Sesión expirada', 'Tu sesión venció o se cerró. Inicia sesión de nuevo para continuar.', 'Iniciar sesión'),
  ErrorKind.forbidden: _Spec(Icons.block, 'Sin permiso', 'Tu cuenta no tiene permiso para ver esta sección. Si crees que es un error, avisa al Administrador.', 'Volver al inicio'),
  ErrorKind.rateLimited: _Spec(Icons.speed, 'Demasiadas solicitudes', 'Hiciste muchas solicitudes en poco tiempo. Espera un momento antes de continuar.', 'Reintentar'),
  ErrorKind.server: _Spec(Icons.error_outline, 'Algo salió mal', 'El servidor tuvo un problema. Ya quedó registrado; inténtalo de nuevo en unos minutos.', 'Reintentar'),
  ErrorKind.unavailable: _Spec(Icons.build_circle_outlined, 'Servicio no disponible', 'El hotel está en mantenimiento o el servidor no responde. Vuelve a intentarlo en un momento.', 'Reintentar'),
};

ErrorKind? errorKindFromName(String? name) {
  for (final k in ErrorKind.values) {
    if (k.name == name) return k;
  }
  return null;
}

/// Pantalla completa de error. `wait` (segundos) deshabilita el botón con cuenta regresiva (429, 503).
class ErrorScreen extends StatefulWidget {
  const ErrorScreen({super.key, required this.kind, this.wait = 0, this.incidentId});

  final ErrorKind kind;
  final int wait;
  final String? incidentId;

  @override
  State<ErrorScreen> createState() => _ErrorScreenState();
}

class _ErrorScreenState extends State<ErrorScreen> {
  late int _left = widget.wait;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    if (_left > 0) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        setState(() => _left = _left - 1);
        if (_left <= 0) _timer?.cancel();
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _act() {
    // Sesión expirada → login; el resto vuelve al inicio, que recarga los datos.
    context.go(widget.kind == ErrorKind.session ? '/login' : '/');
  }

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    final spec = _specs[widget.kind]!;
    final waiting = _left > 0;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Icon(spec.icon, size: 56, color: t.accent),
                const SizedBox(height: 20),
                Text(spec.title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Text(spec.body, textAlign: TextAlign.center, style: TextStyle(color: t.muted, height: 1.4)),
                if (widget.incidentId != null) ...[
                  const SizedBox(height: 8),
                  Text('Código de incidente: ${widget.incidentId}', textAlign: TextAlign.center, style: TextStyle(color: t.muted, fontSize: 12)),
                ],
                const SizedBox(height: 28),
                FilledButton(onPressed: waiting ? null : _act, child: Text(waiting ? 'Espera $_left s' : spec.action)),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
