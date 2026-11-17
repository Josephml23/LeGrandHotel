import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/auth/models.dart';
import '../../core/theme.dart';

class PanelData {
  PanelData({this.dashboard = const {}, this.occupancy});
  final Map<String, dynamic> dashboard;

  /// `/reports/occupancy` (solo Administrador); null si no se pudo leer.
  final Map<String, dynamic>? occupancy;
}

final panelProvider = FutureProvider.autoDispose<PanelData>((ref) async {
  final api = ref.read(apiClientProvider);
  final dash = await api.getOne('/dashboard');
  Map<String, dynamic>? occ;
  // `/reports/occupancy` es solo del Administrador: para otros roles ni se pide, porque un 403
  // en una lectura abriría la pantalla de error global.
  if (ref.read(authProvider).user?.hasRole(Role.admin) ?? false) {
    try {
      final o = await api.getOne('/reports/occupancy');
      if (o is Map) occ = Map<String, dynamic>.from(o);
    } on ApiException {
      // El resumen es opcional: si falla, el panel sigue con el dashboard.
    }
  }
  return PanelData(dashboard: dash is Map ? Map<String, dynamic>.from(dash) : {}, occupancy: occ);
});

num _n(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;
Map<String, dynamic> _m(dynamic v) => v is Map ? Map<String, dynamic>.from(v) : {};
String _money(num v) {
  final s = v.toStringAsFixed(2);
  final parts = s.split('.');
  final buf = StringBuffer();
  for (var i = 0; i < parts[0].length; i++) {
    if (i > 0 && (parts[0].length - i) % 3 == 0) buf.write(',');
    buf.write(parts[0][i]);
  }
  return 'S/ $buf.${parts[1]}';
}

class PanelScreen extends ConsumerWidget {
  const PanelScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = Tokens.of(context);
    final async = ref.watch(panelProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Panel')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.cloud_off_outlined, size: 44, color: t.muted),
              const SizedBox(height: 12),
              Text(e is ApiException ? e.message : 'No se pudo cargar el panel.',
                  textAlign: TextAlign.center, style: TextStyle(color: t.muted)),
              const SizedBox(height: 16),
              SizedBox(
                width: 200,
                child: FilledButton(onPressed: () => ref.invalidate(panelProvider), child: const Text('Reintentar')),
              ),
            ]),
          ),
        ),
        data: (d) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(panelProvider);
            await ref.read(panelProvider.future);
          },
          child: _content(context, t, d),
        ),
      ),
    );
  }

  Widget _content(BuildContext context, Tokens t, PanelData d) {
    final rooms = _m(d.dashboard['rooms']);
    final today = _m(d.dashboard['today']);
    final low = (d.dashboard['low_stock'] as List?) ?? const [];
    final lowCount = _n(d.dashboard['low_stock_count']).toInt();
    final income = d.dashboard['income_month'];
    final tiles = <Widget>[
      if (rooms.isNotEmpty) ...[
        _Kpi('Ocupación', '${_n(rooms['occupancy_rate'])}%', Icons.hotel_outlined),
        _Kpi('Habitaciones libres', '${_n(rooms['available'])}', Icons.meeting_room_outlined),
      ],
      if (today.isNotEmpty) ...[
        _Kpi('Llegadas hoy', '${_n(today['check_ins'])}', Icons.login),
        _Kpi('Salidas hoy', '${_n(today['check_outs'])}', Icons.logout),
      ],
      if (income != null) _Kpi('Ingresos del mes', _money(_n(income)), Icons.payments_outlined),
    ];
    final occ = d.occupancy;
    final byStatus = occ == null ? <String, dynamic>{} : _m(occ['rooms_by_status']);
    const statusLabels = {
      'available': 'Disponibles',
      'occupied': 'Ocupadas',
      'cleaning': 'En limpieza',
      'maintenance': 'En mantenimiento',
    };

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      children: [
        if (tiles.isEmpty && low.isEmpty && occ == null)
          Padding(
            padding: const EdgeInsets.all(32),
            child: Text('No hay indicadores disponibles para tu rol.', textAlign: TextAlign.center, style: TextStyle(color: t.muted)),
          ),
        if (tiles.isNotEmpty)
          LayoutBuilder(builder: (context, c) {
            final w = (c.maxWidth - 12) / 2;
            return Wrap(spacing: 12, runSpacing: 12, children: [for (final k in tiles) SizedBox(width: w, child: k)]);
          }),
        if (occ != null) ...[
          const SizedBox(height: 20),
          _SectionTitle('Resumen de ocupación'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Del ${occ['from']} al ${occ['to']}', style: TextStyle(color: t.muted, fontSize: 13)),
                const SizedBox(height: 12),
                _Bar('Ocupación actual', _n(occ['current_occupancy_rate']).toDouble(),
                    '${_n(occ['occupied_now'])} de ${_n(occ['total_rooms'])} habitaciones'),
                const SizedBox(height: 12),
                _Bar('Ocupación del periodo', _n(occ['occupancy_rate']).toDouble(), '${_n(occ['nights_sold'])} noches vendidas'),
                if (byStatus.isNotEmpty) ...[
                  const Divider(height: 28),
                  for (final e in byStatus.entries)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 3),
                      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                        Text(statusLabels[e.key] ?? e.key),
                        Text('${_n(e.value)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                      ]),
                    ),
                ],
              ]),
            ),
          ),
        ],
        if (d.dashboard.containsKey('low_stock')) ...[
          const SizedBox(height: 20),
          _SectionTitle('Insumos bajo el mínimo ($lowCount)'),
          if (low.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(children: [
                  Icon(Icons.check_circle_outline, color: t.positive),
                  const SizedBox(width: 12),
                  const Expanded(child: Text('Todo el inventario está sobre el mínimo.')),
                ]),
              ),
            )
          else
            Card(
              child: Column(children: [
                for (var i = 0; i < low.length; i++) ...[
                  if (i > 0) const Divider(),
                  ListTile(
                    dense: true,
                    leading: Icon(Icons.warning_amber_rounded, color: t.warning),
                    title: Text('${_m(low[i])['name']}'),
                    subtitle: Text('Mínimo: ${_n(_m(low[i])['min_stock'])} ${_m(low[i])['unit'] ?? ''}'),
                    trailing: Text('${_n(_m(low[i])['stock'])} ${_m(low[i])['unit'] ?? ''}',
                        style: TextStyle(fontWeight: FontWeight.w700, color: t.negative)),
                  ),
                ],
              ]),
            ),
        ],
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600)),
      );
}

class _Kpi extends StatelessWidget {
  const _Kpi(this.label, this.value, this.icon);
  final String label, value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 20, color: t.accent),
          const SizedBox(height: 10),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
          ),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: t.muted, fontSize: 13)),
        ]),
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar(this.label, this.percent, this.detail);
  final String label, detail;
  final double percent;

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(label),
        Text('$percent%', style: const TextStyle(fontWeight: FontWeight.w700)),
      ]),
      const SizedBox(height: 6),
      ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: LinearProgressIndicator(
          value: (percent / 100).clamp(0.0, 1.0),
          minHeight: 8,
          backgroundColor: t.raised,
          color: t.accent,
        ),
      ),
      const SizedBox(height: 4),
      Text(detail, style: TextStyle(color: t.muted, fontSize: 12)),
    ]);
  }
}
