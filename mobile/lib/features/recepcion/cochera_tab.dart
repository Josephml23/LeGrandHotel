import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme.dart';
import 'widgets.dart';

/// Cochera: espacios, entrada de un vehículo y salida.
/// `GET /parking-spots`, `GET /parking-assignments?active=1`, `POST /parking-assignments`,
/// `PUT /parking-assignments/{id}` con `left_at`.
class CocheraTab extends ConsumerStatefulWidget {
  const CocheraTab({super.key});

  @override
  ConsumerState<CocheraTab> createState() => _CocheraTabState();
}

class _CocheraData {
  _CocheraData(this.espacios, this.activos);
  final List<Map<String, dynamic>> espacios;
  final List<Map<String, dynamic>> activos;
}

class _CocheraTabState extends ConsumerState<CocheraTab> with AutomaticKeepAliveClientMixin {
  late Future<_CocheraData> _future = _load();

  @override
  bool get wantKeepAlive => true;

  Future<_CocheraData> _load() async {
    final api = ref.read(apiClientProvider);
    final r = await Future.wait([
      api.getList('/parking-spots', params: {'per_page': 50}),
      api.getList('/parking-assignments', params: {'active': 1, 'per_page': 50}),
    ]);
    return _CocheraData(r[0].data, r[1].data);
  }

  Future<void> _reload() async {
    final f = _load();
    setState(() => _future = f);
    try {
      await f;
    } catch (_) {}
  }

  Future<void> _entrada(List<Map<String, dynamic>> libres, Map<String, dynamic>? preferido) async {
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _EntradaSheet(libres: libres, inicial: preferido),
    );
    if (ok == true && mounted) {
      aviso(context, 'Entrada registrada.');
      await _reload();
    }
  }

  Future<void> _salida(Map<String, dynamic> a) async {
    final ok = await confirmar(context, 'Salida de vehículo', '¿Registrar la salida del vehículo ${a['plate']} del espacio ${a['parking_spot']?['code'] ?? ''}?', 'Registrar salida');
    if (!ok) return;
    try {
      await ref.read(apiClientProvider).send('put', '/parking-assignments/${a['id']}', body: {'left_at': DateTime.now().toUtc().toIso8601String()});
      if (!mounted) return;
      aviso(context, 'Salida registrada. El espacio quedó libre.');
      await _reload();
    } catch (e) {
      if (mounted) aviso(context, mensajeDeError(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final t = Tokens.of(context);
    ref.listen(recepcionRefreshProvider, (_, _) => _reload());
    return RefreshIndicator(
      onRefresh: _reload,
      child: FutureView<_CocheraData>(
        future: _future,
        onRetry: _reload,
        builder: (context, d) {
          final libres = d.espacios.where((s) => s['status'] == 'free').toList();
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              FilledButton.icon(
                onPressed: libres.isEmpty ? null : () => _entrada(libres, null),
                icon: const Icon(Icons.login),
                label: Text(libres.isEmpty ? 'No hay espacios libres' : 'Registrar entrada'),
              ),
              SectionTitle('Espacios', count: d.espacios.length),
              if (d.espacios.isEmpty) const EmptyState('No hay espacios de cochera registrados.', icon: Icons.local_parking),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final s in d.espacios)
                  InkWell(
                    borderRadius: BorderRadius.circular(radiusCard),
                    onTap: s['status'] == 'free' ? () => _entrada(libres, s) : null,
                    child: Container(
                      width: 76,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: t.surface,
                        borderRadius: BorderRadius.circular(radiusCard),
                        border: Border.all(color: s['status'] == 'free' ? t.positive : t.border),
                      ),
                      child: Column(children: [
                        Text('${s['code']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text(
                          switch ('${s['status']}') {
                            'free' => 'Libre',
                            'occupied' => 'Ocupado',
                            _ => 'Mant.',
                          },
                          style: TextStyle(fontSize: 12, color: s['status'] == 'free' ? t.positive : t.muted),
                        ),
                      ]),
                    ),
                  ),
              ]),
              SectionTitle('Vehículos dentro', count: d.activos.length),
              if (d.activos.isEmpty) const EmptyState('No hay vehículos en la cochera.', icon: Icons.directions_car_outlined),
              for (final a in d.activos)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${a['plate']} · espacio ${a['parking_spot']?['code'] ?? '—'}', style: const TextStyle(fontWeight: FontWeight.w600)),
                            const SizedBox(height: 2),
                            Text(
                              [
                                'Entró ${fechaHora('${a['entered_at']}')}',
                                if (a['stay']?['reservation']?['client']?['full_name'] != null) '${a['stay']['reservation']['client']['full_name']}',
                                if (a['stay']?['reservation']?['room']?['number'] != null) 'hab. ${a['stay']['reservation']['room']['number']}',
                              ].join(' · '),
                              style: TextStyle(color: t.muted, fontSize: 13),
                            ),
                          ]),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton(
                          style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 16)),
                          onPressed: () => _salida(a),
                          child: const Text('Salida'),
                        ),
                      ]),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// Entrada de un vehículo; si el huésped está dentro, se puede vincular a su estadía.
class _EntradaSheet extends ConsumerStatefulWidget {
  const _EntradaSheet({required this.libres, this.inicial});
  final List<Map<String, dynamic>> libres;
  final Map<String, dynamic>? inicial;

  @override
  ConsumerState<_EntradaSheet> createState() => _EntradaSheetState();
}

class _EntradaSheetState extends ConsumerState<_EntradaSheet> {
  final _placa = TextEditingController();
  late int? _espacio = (widget.inicial?['id'] as num?)?.toInt() ?? (widget.libres.isNotEmpty ? (widget.libres.first['id'] as num?)?.toInt() : null);
  int? _estadia;
  late final Future<List<Map<String, dynamic>>> _estadias =
      ref.read(apiClientProvider).getList('/stays', params: {'active': 1, 'per_page': 50}).then((r) => r.data);
  bool _guardando = false;
  String? _error;
  String? _errorPlaca;

  @override
  void dispose() {
    _placa.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    setState(() {
      _guardando = true;
      _error = null;
      _errorPlaca = null;
    });
    try {
      await ref.read(apiClientProvider).send('post', '/parking-assignments', body: {
        'parking_spot_id': _espacio,
        'plate': _placa.text.trim(),
        if (_estadia != null) 'stay_id': _estadia,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        if (e is ApiException) {
          _errorPlaca = e.field('plate');
          if (_errorPlaca == null) _error = e.message;
        } else {
          _error = 'No se pudo registrar la entrada.';
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Entrada de vehículo', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          TextField(
            controller: _placa,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(labelText: 'Placa', errorText: _errorPlaca),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<int>(
            initialValue: _espacio,
            decoration: const InputDecoration(labelText: 'Espacio'),
            items: [for (final s in widget.libres) DropdownMenuItem(value: (s['id'] as num).toInt(), child: Text('${s['code']}'))],
            onChanged: (v) => setState(() => _espacio = v),
          ),
          const SizedBox(height: 12),
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _estadias,
            builder: (context, snap) {
              final lista = snap.data ?? const <Map<String, dynamic>>[];
              return DropdownButtonFormField<int?>(
                initialValue: _estadia,
                isExpanded: true,
                decoration: InputDecoration(labelText: 'Huésped (opcional)', helperText: snap.hasError ? 'No se pudo cargar la lista de huéspedes.' : null),
                items: [
                  const DropdownMenuItem<int?>(value: null, child: Text('Sin huésped (visita)')),
                  for (final s in lista)
                    DropdownMenuItem<int?>(
                      value: (s['id'] as num).toInt(),
                      child: Text('${s['reservation']?['client']?['full_name'] ?? 'Huésped'} · hab. ${s['reservation']?['room']?['number'] ?? ''}', overflow: TextOverflow.ellipsis),
                    ),
                ],
                onChanged: (v) => setState(() => _estadia = v),
              );
            },
          ),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: TextStyle(color: t.negative))),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _guardando || _espacio == null ? null : _guardar,
            child: _guardando ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Registrar entrada'),
          ),
        ]),
      ),
    );
  }
}
