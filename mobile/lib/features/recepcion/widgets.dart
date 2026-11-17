import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/theme.dart';

/// Se incrementa cuando una pantalla cambia datos que otras muestran (reserva, check-in…).
class RecepcionRefresh extends Notifier<int> {
  @override
  int build() => 0;
  void bump() => state++;
}

final recepcionRefreshProvider = NotifierProvider<RecepcionRefresh, int>(RecepcionRefresh.new);

/// `yyyy-MM-dd` de una fecha.
String ymd(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String todayYmd() => ymd(DateTime.now());

/// `17/11/2026` a partir de `2026-11-17` (o de un ISO con hora).
String fechaCorta(String? iso) {
  if (iso == null || iso.length < 10) return '—';
  return '${iso.substring(8, 10)}/${iso.substring(5, 7)}/${iso.substring(0, 4)}';
}

/// `17/11 14:30` a partir de un ISO con hora (hora local del dispositivo).
String fechaHora(String? iso) {
  final d = iso == null ? null : DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '—';
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(d.day)}/${two(d.month)} ${two(d.hour)}:${two(d.minute)}';
}

String mensajeDeError(Object e) => e is ApiException ? e.message : 'No se pudo completar la acción.';

void aviso(BuildContext context, String texto, {bool error = false}) {
  final t = Tokens.of(context);
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(texto), backgroundColor: error ? t.negative : null));
}

Future<bool> confirmar(BuildContext context, String titulo, String texto, String accion) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(titulo),
      content: Text(texto),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancelar')),
        TextButton(onPressed: () => Navigator.pop(c, true), child: Text(accion)),
      ],
    ),
  );
  return r ?? false;
}

/// Carga / error / contenido de un `Future`. El vacío lo resuelve quien construye el contenido con [EmptyState].
class FutureView<T> extends StatelessWidget {
  const FutureView({super.key, required this.future, required this.onRetry, required this.builder});

  final Future<T> future;
  final VoidCallback onRetry;
  final Widget Function(BuildContext, T) builder;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<T>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return ErrorState(message: mensajeDeError(snap.error!), onRetry: onRetry);
        }
        return builder(context, snap.data as T);
      },
    );
  }
}

class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(32), children: [
      const SizedBox(height: 48),
      Icon(Icons.error_outline, size: 40, color: t.negative),
      const SizedBox(height: 12),
      Text(message, textAlign: TextAlign.center),
      const SizedBox(height: 16),
      Center(child: OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: const Size(140, 44)), onPressed: onRetry, child: const Text('Reintentar'))),
    ]);
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState(this.text, {super.key, this.icon = Icons.inbox_outlined});
  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
      child: Column(children: [
        Icon(icon, size: 36, color: t.muted),
        const SizedBox(height: 8),
        Text(text, textAlign: TextAlign.center, style: TextStyle(color: t.muted)),
      ]),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.count});
  final String text;
  final int? count;

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
      child: Row(children: [
        Text(text, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        if (count != null) ...[
          const SizedBox(width: 8),
          Text('$count', style: TextStyle(color: t.muted)),
        ],
      ]),
    );
  }
}

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.color, this.background});
  final String text;
  final Color? color;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: background ?? t.raised, borderRadius: BorderRadius.circular(99)),
      child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color ?? t.muted)),
    );
  }
}

/// Botón compacto para tarjetas (el tema fuerza 48 de alto y ancho completo).
ButtonStyle botonCompacto() => FilledButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 16));
