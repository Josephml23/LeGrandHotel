import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme.dart';
import 'widgets.dart';

/// Nueva reserva en tres pasos: huésped → fechas → habitación disponible.
/// `GET /clients?search=`, `POST /clients`, `GET /rooms/available`, `POST /reservations`.
class ReservarTab extends ConsumerStatefulWidget {
  const ReservarTab({super.key, required this.onCreated});
  final VoidCallback onCreated;

  @override
  ConsumerState<ReservarTab> createState() => _ReservarTabState();
}

class _ReservarTabState extends ConsumerState<ReservarTab> with AutomaticKeepAliveClientMixin {
  int _paso = 0;
  Map<String, dynamic>? _cliente;
  DateTimeRange? _fechas;
  int _huespedes = 1;
  Map<String, dynamic>? _habitacion;
  bool _guardando = false;

  final _busqueda = TextEditingController();
  Timer? _debounce;
  Future<List<Map<String, dynamic>>>? _clientes;
  Future<List<Map<String, dynamic>>>? _disponibles;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _clientes = _buscarClientes('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _busqueda.dispose();
    super.dispose();
  }

  Future<List<Map<String, dynamic>>> _buscarClientes(String q) async =>
      (await ref.read(apiClientProvider).getList('/clients', params: {'search': q.trim(), 'per_page': 20})).data;

  void _alEscribir(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      if (mounted) setState(() => _clientes = _buscarClientes(v));
    });
  }

  Future<List<Map<String, dynamic>>> _cargarDisponibles() async =>
      (await ref.read(apiClientProvider).getList('/rooms/available', params: {
        'from': ymd(_fechas!.start),
        'to': ymd(_fechas!.end),
        'guests': _huespedes,
        'per_page': 50,
      }))
          .data;

  Future<void> _elegirFechas() async {
    final hoy = DateTime.now();
    final r = await showDateRangePicker(
      context: context,
      firstDate: DateTime(hoy.year, hoy.month, hoy.day),
      lastDate: DateTime(hoy.year + 2),
      initialDateRange: _fechas,
      helpText: 'Entrada y salida',
      saveText: 'Aceptar',
      cancelText: 'Cancelar',
    );
    if (r != null) {
      setState(() {
        _fechas = r;
        _habitacion = null;
      });
    }
  }

  void _irAHabitaciones() {
    setState(() {
      _paso = 2;
      _habitacion = null;
      _disponibles = _cargarDisponibles();
    });
  }

  Future<void> _nuevoCliente() async {
    final c = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _NuevoClienteSheet(),
    );
    if (c != null && mounted) {
      setState(() {
        _cliente = c;
        _paso = 1;
      });
    }
  }

  Future<void> _reservar() async {
    setState(() => _guardando = true);
    try {
      await ref.read(apiClientProvider).send('post', '/reservations', body: {
        'client_id': _cliente!['id'],
        'room_id': _habitacion!['id'],
        'check_in': ymd(_fechas!.start),
        'check_out': ymd(_fechas!.end),
        'guests': _huespedes,
      });
      if (!mounted) return;
      aviso(context, 'Reserva creada para ${_cliente!['full_name']} en la habitación ${_habitacion!['number']}.');
      ref.read(recepcionRefreshProvider.notifier).bump();
      setState(() {
        _paso = 0;
        _cliente = null;
        _fechas = null;
        _habitacion = null;
        _huespedes = 1;
        _disponibles = null;
      });
      widget.onCreated();
    } catch (e) {
      if (!mounted) return;
      aviso(context, mensajeDeError(e), error: true);
      if (e is ApiException && e.code == 'ROOM_ALREADY_BOOKED') _irAHabitaciones();
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Stepper(
      currentStep: _paso,
      physics: const ClampingScrollPhysics(),
      controlsBuilder: (_, _) => const SizedBox.shrink(),
      onStepTapped: (i) {
        if (i == 0) {
          setState(() => _paso = 0);
        } else if (i == 1 && _cliente != null) {
          setState(() => _paso = 1);
        } else if (i == 2 && _cliente != null && _fechas != null) {
          _irAHabitaciones();
        }
      },
      steps: [
        Step(
          title: Text(_cliente == null ? 'Huésped' : 'Huésped: ${_cliente!['full_name']}'),
          isActive: _paso >= 0,
          state: _cliente != null && _paso > 0 ? StepState.complete : StepState.indexed,
          content: _pasoHuesped(),
        ),
        Step(
          title: Text(_fechas == null ? 'Fechas' : 'Del ${fechaCorta(ymd(_fechas!.start))} al ${fechaCorta(ymd(_fechas!.end))}'),
          isActive: _paso >= 1,
          state: _fechas != null && _paso > 1 ? StepState.complete : StepState.indexed,
          content: _pasoFechas(),
        ),
        Step(
          title: const Text('Habitación disponible'),
          isActive: _paso >= 2,
          content: _pasoHabitacion(),
        ),
      ],
    );
  }

  Widget _pasoHuesped() {
    final t = Tokens.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      TextField(
        controller: _busqueda,
        onChanged: _alEscribir,
        decoration: const InputDecoration(hintText: 'Buscar por nombre o documento', prefixIcon: Icon(Icons.search)),
      ),
      const SizedBox(height: 8),
      FutureBuilder<List<Map<String, dynamic>>>(
        future: _clientes,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
          }
          if (snap.hasError) {
            return Column(children: [
              Text(mensajeDeError(snap.error!)),
              TextButton(onPressed: () => setState(() => _clientes = _buscarClientes(_busqueda.text)), child: const Text('Reintentar')),
            ]);
          }
          final lista = snap.data!;
          if (lista.isEmpty) return const EmptyState('No hay huéspedes con esa búsqueda.', icon: Icons.person_search);
          return Column(children: [
            for (final c in lista)
              Card(
                margin: const EdgeInsets.only(bottom: 6),
                child: ListTile(
                  title: Text('${c['full_name']}'),
                  subtitle: Text('${c['document_type'] ?? ''} ${c['document_number'] ?? 'sin documento'}', style: TextStyle(color: t.muted)),
                  trailing: _cliente?['id'] == c['id'] ? Icon(Icons.check_circle, color: t.accent) : null,
                  onTap: () => setState(() {
                    _cliente = c;
                    _paso = 1;
                  }),
                ),
              ),
          ]);
        },
      ),
      const SizedBox(height: 8),
      OutlinedButton.icon(onPressed: _nuevoCliente, icon: const Icon(Icons.person_add_alt), label: const Text('Registrar huésped nuevo')),
    ]);
  }

  Widget _pasoFechas() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      OutlinedButton.icon(
        onPressed: _elegirFechas,
        icon: const Icon(Icons.date_range),
        label: Text(_fechas == null ? 'Elegir entrada y salida' : '${fechaCorta(ymd(_fechas!.start))} → ${fechaCorta(ymd(_fechas!.end))}'),
      ),
      const SizedBox(height: 12),
      Row(children: [
        const Expanded(child: Text('Huéspedes')),
        IconButton(onPressed: _huespedes > 1 ? () => setState(() => _huespedes--) : null, icon: const Icon(Icons.remove_circle_outline)),
        Text('$_huespedes', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        IconButton(onPressed: _huespedes < 20 ? () => setState(() => _huespedes++) : null, icon: const Icon(Icons.add_circle_outline)),
      ]),
      const SizedBox(height: 8),
      FilledButton(onPressed: _fechas == null ? null : _irAHabitaciones, child: const Text('Ver habitaciones disponibles')),
    ]);
  }

  Widget _pasoHabitacion() {
    final t = Tokens.of(context);
    if (_disponibles == null) return const EmptyState('Elige primero huésped y fechas.');
    final noches = _fechas == null ? 0 : _fechas!.end.difference(_fechas!.start).inDays;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(
        child: FutureBuilder<List<Map<String, dynamic>>>(
          future: _disponibles,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
            }
            if (snap.hasError) {
              return Column(children: [
                Text(mensajeDeError(snap.error!)),
                TextButton(onPressed: () => setState(() => _disponibles = _cargarDisponibles()), child: const Text('Reintentar')),
              ]);
            }
            final lista = snap.data!;
            if (lista.isEmpty) return const EmptyState('No hay habitaciones libres para esas fechas y esa cantidad de huéspedes.', icon: Icons.bed_outlined);
            return Column(children: [
              for (final h in lista)
                Builder(builder: (_) {
                  final precio = double.tryParse('${h['room_type']?['price_per_night']}') ?? 0;
                  final sel = _habitacion?['id'] == h['id'];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 6),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(radiusCard),
                      side: BorderSide(color: sel ? t.accent : t.border, width: sel ? 2 : 1),
                    ),
                    child: ListTile(
                      title: Text('Hab. ${h['number']} · ${h['room_type']?['name'] ?? ''}'),
                      subtitle: Text('Piso ${h['floor']} · hasta ${h['room_type']?['capacity']} huésp. · S/ ${precio.toStringAsFixed(2)} por noche', style: TextStyle(color: t.muted)),
                      trailing: sel ? Icon(Icons.check_circle, color: t.accent) : null,
                      onTap: () => setState(() => _habitacion = h),
                    ),
                  );
                }),
            ]);
          },
        ),
      ),
      if (_habitacion != null) ...[
        const SizedBox(height: 8),
        Text(
          'Total: S/ ${((double.tryParse('${_habitacion!['room_type']?['price_per_night']}') ?? 0) * noches).toStringAsFixed(2)} por $noches ${noches == 1 ? 'noche' : 'noches'}',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: _guardando ? null : _reservar,
          child: _guardando ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Crear reserva'),
        ),
      ],
    ]);
  }
}

/// Alta rápida de un huésped (`POST /clients`).
class _NuevoClienteSheet extends ConsumerStatefulWidget {
  const _NuevoClienteSheet();

  @override
  ConsumerState<_NuevoClienteSheet> createState() => _NuevoClienteSheetState();
}

class _NuevoClienteSheetState extends ConsumerState<_NuevoClienteSheet> {
  final _nombre = TextEditingController();
  final _documento = TextEditingController();
  final _telefono = TextEditingController();
  String _tipo = 'DNI';
  bool _guardando = false;
  String? _error;
  Map<String, String> _errores = {};

  @override
  void dispose() {
    _nombre.dispose();
    _documento.dispose();
    _telefono.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    setState(() {
      _guardando = true;
      _error = null;
      _errores = {};
    });
    try {
      final c = await ref.read(apiClientProvider).send('post', '/clients', body: {
        'full_name': _nombre.text.trim(),
        'document_type': _tipo,
        'document_number': _documento.text.trim(),
        if (_telefono.text.trim().isNotEmpty) 'phone': _telefono.text.trim(),
      });
      if (mounted) Navigator.pop(context, Map<String, dynamic>.from(c as Map));
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        if (e is ApiException) {
          _errores = {
            for (final k in ['full_name', 'document_number', 'phone'])
              if (e.field(k) != null) k: e.field(k)!,
          };
          if (_errores.isEmpty) _error = e.message;
        } else {
          _error = 'No se pudo guardar.';
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
          const Text('Huésped nuevo', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          TextField(controller: _nombre, textCapitalization: TextCapitalization.words, decoration: InputDecoration(labelText: 'Nombre completo', errorText: _errores['full_name'])),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _tipo,
            decoration: const InputDecoration(labelText: 'Tipo de documento'),
            items: const [
              DropdownMenuItem(value: 'DNI', child: Text('DNI')),
              DropdownMenuItem(value: 'CE', child: Text('Carné de extranjería')),
              DropdownMenuItem(value: 'PASAPORTE', child: Text('Pasaporte')),
            ],
            onChanged: (v) => setState(() => _tipo = v ?? 'DNI'),
          ),
          const SizedBox(height: 12),
          TextField(controller: _documento, decoration: InputDecoration(labelText: 'Número de documento', errorText: _errores['document_number'])),
          const SizedBox(height: 12),
          TextField(controller: _telefono, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: 'Celular (opcional)', errorText: _errores['phone'])),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: TextStyle(color: t.negative))),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _guardando ? null : _guardar,
            child: _guardando ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Guardar y continuar'),
          ),
        ]),
      ),
    );
  }
}
