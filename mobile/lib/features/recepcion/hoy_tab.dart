import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/theme.dart';
import 'widgets.dart';

/// Llegadas del día (check-in) y huéspedes dentro del hotel (check-out).
/// `GET /reservations?check_in=hoy`, `GET /stays?active=1`,
/// `POST /reservations/{id}/check-in`, `POST /stays/{id}/check-out`.
class HoyTab extends ConsumerStatefulWidget {
  const HoyTab({super.key});

  @override
  ConsumerState<HoyTab> createState() => _HoyTabState();
}

class _HoyData {
  _HoyData(this.llegadas, this.dentro);
  final List<Map<String, dynamic>> llegadas;
  final List<Map<String, dynamic>> dentro;
}

class _HoyTabState extends ConsumerState<HoyTab> with AutomaticKeepAliveClientMixin {
  late Future<_HoyData> _future = _load();
  final _busy = <String>{};

  @override
  bool get wantKeepAlive => true;

  Future<_HoyData> _load() async {
    final api = ref.read(apiClientProvider);
    final res = await Future.wait([
      api.getList('/reservations', params: {'check_in': todayYmd(), 'per_page': 50}),
      api.getList('/stays', params: {'active': 1, 'per_page': 50}),
    ]);
    final llegadas = res[0].data.where((r) => r['status'] != 'cancelled').toList();
    return _HoyData(llegadas, res[1].data);
  }

  Future<void> _reload() async {
    final f = _load();
    setState(() => _future = f);
    try {
      await f;
    } catch (_) {}
  }

  Future<void> _accion(String key, String okMsg, Future<void> Function() run) async {
    setState(() => _busy.add(key));
    try {
      await run();
      if (!mounted) return;
      aviso(context, okMsg);
      ref.read(recepcionRefreshProvider.notifier).bump();
      await _reload();
    } catch (e) {
      if (mounted) aviso(context, mensajeDeError(e), error: true);
    } finally {
      if (mounted) setState(() => _busy.remove(key));
    }
  }

  Future<void> _checkIn(Map<String, dynamic> r) async {
    final hab = r['room']?['number'] ?? '';
    final ok = await confirmar(context, 'Check-in', '¿Registrar la llegada de ${r['client']?['full_name'] ?? 'el huésped'} a la habitación $hab?', 'Registrar');
    if (!ok) return;
    await _accion('r${r['id']}', 'Check-in registrado.', () => ref.read(apiClientProvider).send('post', '/reservations/${r['id']}/check-in'));
  }

  Future<void> _checkOut(Map<String, dynamic> s) async {
    final res = s['reservation'] as Map? ?? const {};
    final ok = await confirmar(context, 'Check-out', '¿Registrar la salida de ${res['client']?['full_name'] ?? 'el huésped'} (hab. ${res['room']?['number'] ?? ''})? La habitación pasará a limpieza y se libera su cochera.', 'Registrar salida');
    if (!ok) return;
    await _accion('s${s['id']}', 'Check-out registrado.', () => ref.read(apiClientProvider).send('post', '/stays/${s['id']}/check-out'));
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    ref.listen(recepcionRefreshProvider, (_, _) => _reload());
    return RefreshIndicator(
      onRefresh: _reload,
      child: FutureView<_HoyData>(
        future: _future,
        onRetry: _reload,
        builder: (context, d) {
          final hoy = todayYmd();
          bool sale(Map<String, dynamic> s) => ('${s['reservation']?['check_out'] ?? ''}').compareTo(hoy) <= 0;
          final salidas = d.dentro.where(sale).toList();
          final enHotel = d.dentro.where((s) => !sale(s)).toList();
          final pendientes = d.llegadas.where((r) => r['status'] == 'pending' || r['status'] == 'confirmed').toList();
          final yaDentro = d.llegadas.where((r) => r['status'] == 'checked_in' || r['status'] == 'completed').toList();
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            children: [
              SectionTitle('Llegadas de hoy', count: pendientes.length),
              if (pendientes.isEmpty) const EmptyState('No quedan llegadas por registrar hoy.', icon: Icons.login),
              for (final r in pendientes) _llegada(r),
              if (yaDentro.isNotEmpty) ...[
                SectionTitle('Llegadas ya registradas', count: yaDentro.length),
                for (final r in yaDentro) _llegada(r),
              ],
              SectionTitle('Salidas de hoy', count: salidas.length),
              if (salidas.isEmpty) const EmptyState('No hay salidas pendientes hoy.', icon: Icons.logout),
              for (final s in salidas) _estadia(s, saleHoy: true),
              SectionTitle('En el hotel', count: enHotel.length),
              if (enHotel.isEmpty) const EmptyState('No hay otros huéspedes dentro.', icon: Icons.hotel_outlined),
              for (final s in enHotel) _estadia(s, saleHoy: false),
            ],
          );
        },
      ),
    );
  }

  Widget _tarjeta({required String titulo, required String sub, Widget? pill, Widget? accion}) {
    final t = Tokens.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [Flexible(child: Text(titulo, style: const TextStyle(fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis)), if (pill != null) ...[const SizedBox(width: 8), pill]]),
                const SizedBox(height: 2),
                Text(sub, style: TextStyle(color: t.muted, fontSize: 13)),
              ]),
            ),
            if (accion != null) ...[const SizedBox(width: 8), accion],
          ]),
        ),
      ),
    );
  }

  Widget _llegada(Map<String, dynamic> r) {
    final t = Tokens.of(context);
    final status = '${r['status']}';
    final key = 'r${r['id']}';
    final puede = status == 'pending' || status == 'confirmed';
    return _tarjeta(
      titulo: '${r['client']?['full_name'] ?? 'Huésped'}',
      sub: 'Hab. ${r['room']?['number'] ?? '—'} · ${r['room']?['room_type']?['name'] ?? ''} · hasta ${fechaCorta('${r['check_out']}')} · ${r['guests'] ?? 1} huésp.',
      pill: puede ? null : Pill(status == 'completed' ? 'Salió' : 'Dentro', color: t.positive),
      accion: puede
          ? FilledButton(
              style: botonCompacto(),
              onPressed: _busy.contains(key) ? null : () => _checkIn(r),
              child: _busy.contains(key) ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Check-in'),
            )
          : null,
    );
  }

  Widget _estadia(Map<String, dynamic> s, {required bool saleHoy}) {
    final t = Tokens.of(context);
    final res = s['reservation'] as Map? ?? const {};
    final key = 's${s['id']}';
    return _tarjeta(
      titulo: '${res['client']?['full_name'] ?? 'Huésped'}',
      sub: 'Hab. ${res['room']?['number'] ?? '—'} · entró ${fechaHora('${s['checked_in_at']}')} · sale ${fechaCorta('${res['check_out']}')}',
      pill: saleHoy ? Pill('Sale hoy', color: t.warningInk, background: t.warningSoft) : null,
      accion: OutlinedButton(
        style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 16)),
        onPressed: _busy.contains(key) ? null : () => _checkOut(s),
        child: _busy.contains(key) ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Check-out'),
      ),
    );
  }
}
