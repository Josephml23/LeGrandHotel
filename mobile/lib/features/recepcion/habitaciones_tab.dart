import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/theme.dart';
import 'widgets.dart';

const _estados = {
  'available': 'Disponible',
  'occupied': 'Ocupada',
  'cleaning': 'En limpieza',
  'maintenance': 'Mantenimiento',
};

/// Habitaciones agrupadas por piso con cambio de estado.
/// `GET /rooms`, `PATCH /rooms/{id}/status`.
class HabitacionesTab extends ConsumerStatefulWidget {
  const HabitacionesTab({super.key});

  @override
  ConsumerState<HabitacionesTab> createState() => _HabitacionesTabState();
}

class _HabitacionesTabState extends ConsumerState<HabitacionesTab> with AutomaticKeepAliveClientMixin {
  late Future<List<Map<String, dynamic>>> _future = _load();
  String? _filtro;

  @override
  bool get wantKeepAlive => true;

  Future<List<Map<String, dynamic>>> _load() async {
    final api = ref.read(apiClientProvider);
    final todas = <Map<String, dynamic>>[];
    var pagina = 1;
    while (true) {
      final r = await api.getList('/rooms', params: {'per_page': 50, 'page': pagina});
      todas.addAll(r.data);
      if (pagina >= r.lastPage) break;
      pagina++;
    }
    return todas;
  }

  Future<void> _reload() async {
    final f = _load();
    setState(() => _future = f);
    try {
      await f;
    } catch (_) {}
  }

  Color _color(Tokens t, String s) => switch (s) {
        'available' => t.positive,
        'occupied' => t.accent,
        'cleaning' => t.warning,
        _ => t.negative,
      };

  Future<void> _cambiar(Map<String, dynamic> h) async {
    final nuevo = await showModalBottomSheet<String>(
      context: context,
      builder: (c) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text('Habitación ${h['number']}: cambiar estado', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          ),
          for (final e in _estados.entries)
            ListTile(
              leading: Icon(Icons.circle, size: 14, color: _color(Tokens.of(c), e.key)),
              title: Text(e.value),
              trailing: h['status'] == e.key ? const Icon(Icons.check) : null,
              onTap: () => Navigator.pop(c, e.key),
            ),
        ]),
      ),
    );
    if (nuevo == null || nuevo == h['status'] || !mounted) return;
    try {
      await ref.read(apiClientProvider).send('patch', '/rooms/${h['id']}/status', body: {'status': nuevo});
      if (!mounted) return;
      aviso(context, 'Habitación ${h['number']}: ${_estados[nuevo]!.toLowerCase()}.');
      ref.read(recepcionRefreshProvider.notifier).bump();
      await _reload();
    } catch (e) {
      if (mounted) aviso(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final t = Tokens.of(context);
    return Column(children: [
      SizedBox(
        height: 52,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          children: [
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: ChoiceChip(label: const Text('Todas'), selected: _filtro == null, onSelected: (_) => setState(() => _filtro = null)),
            ),
            for (final e in _estados.entries)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(label: Text(e.value), selected: _filtro == e.key, onSelected: (_) => setState(() => _filtro = e.key)),
              ),
          ],
        ),
      ),
      Expanded(
        child: RefreshIndicator(
          onRefresh: _reload,
          child: FutureView<List<Map<String, dynamic>>>(
            future: _future,
            onRetry: _reload,
            builder: (context, todas) {
              final lista = todas.where((h) => _filtro == null || h['status'] == _filtro).toList();
              if (lista.isEmpty) {
                return ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [EmptyState(todas.isEmpty ? 'Aún no hay habitaciones registradas.' : 'Ninguna habitación con ese estado.', icon: Icons.bed_outlined)],
                );
              }
              final pisos = <int, List<Map<String, dynamic>>>{};
              for (final h in lista) {
                pisos.putIfAbsent((h['floor'] as num?)?.toInt() ?? 0, () => []).add(h);
              }
              final claves = pisos.keys.toList()..sort();
              return ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                children: [
                  for (final p in claves) ...[
                    SectionTitle('Piso $p', count: pisos[p]!.length),
                    for (final h in pisos[p]!)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Card(
                          child: ListTile(
                            onTap: () => _cambiar(h),
                            title: Text('Hab. ${h['number']} · ${h['room_type']?['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text('Hasta ${h['room_type']?['capacity'] ?? '—'} huéspedes', style: TextStyle(color: t.muted)),
                            trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                              Pill(_estados['${h['status']}'] ?? '${h['status']}', color: _color(t, '${h['status']}')),
                              const SizedBox(width: 4),
                              Icon(Icons.chevron_right, color: t.muted),
                            ]),
                          ),
                        ),
                      ),
                  ],
                ],
              );
            },
          ),
        ),
      ),
    ]);
  }
}
