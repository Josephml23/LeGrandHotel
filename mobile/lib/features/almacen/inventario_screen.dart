import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme.dart';

class InventoryItem {
  InventoryItem({required this.id, required this.name, required this.unit, required this.stock, required this.minStock});

  final int id;
  final String name, unit;
  final int stock, minStock;

  bool get low => stock <= minStock;

  factory InventoryItem.fromJson(Map<String, dynamic> j) => InventoryItem(
        id: (j['id'] as num).toInt(),
        name: '${j['name'] ?? ''}',
        unit: '${j['unit'] ?? ''}',
        stock: (j['stock'] as num?)?.toInt() ?? 0,
        minStock: (j['min_stock'] as num?)?.toInt() ?? 0,
      );
}

class InventarioScreen extends ConsumerStatefulWidget {
  const InventarioScreen({super.key});

  @override
  ConsumerState<InventarioScreen> createState() => _InventarioScreenState();
}

class _InventarioScreenState extends ConsumerState<InventarioScreen> {
  final _search = TextEditingController();
  final _scroll = ScrollController();
  Timer? _debounce;
  List<InventoryItem> _items = [];
  bool _loading = true, _loadingMore = false, _onlyLow = false;
  ApiException? _error;
  int _page = 1, _lastPage = 1;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 200) _more();
    });
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Map<String, dynamic> _params(int page) => {
        'page': page,
        'per_page': 20,
        'search': _search.text.trim(),
        if (_onlyLow) 'low_stock': 1,
      };

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await ref.read(apiClientProvider).getList('/inventory-items', params: _params(1));
      if (!mounted) return;
      setState(() {
        _items = res.data.map(InventoryItem.fromJson).toList();
        _page = 1;
        _lastPage = res.lastPage;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    }
  }

  Future<void> _more() async {
    if (_loading || _loadingMore || _page >= _lastPage) return;
    setState(() => _loadingMore = true);
    try {
      final res = await ref.read(apiClientProvider).getList('/inventory-items', params: _params(_page + 1));
      if (!mounted) return;
      setState(() {
        _items = [..._items, ...res.data.map(InventoryItem.fromJson)];
        _page++;
        _lastPage = res.lastPage;
      });
    } on ApiException {
      // Se reintenta al seguir desplazando.
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _onSearch(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), _load);
  }

  Future<void> _openMovement(InventoryItem item) async {
    final updated = await showModalBottomSheet<InventoryItem>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _MovementSheet(item: item),
    );
    if (updated == null || !mounted) return;
    setState(() {
      _items = [
        for (final i in _items) i.id == updated.id ? updated : i,
      ];
      if (_onlyLow) _items = _items.where((i) => i.low).toList();
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${updated.name}: ahora hay ${updated.stock} ${updated.unit}.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Inventario')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: Column(children: [
            TextField(
              controller: _search,
              onChanged: _onSearch,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Buscar insumo',
                prefixIcon: const Icon(Icons.search),
                isDense: true,
                suffixIcon: _search.text.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.close),
                        tooltip: 'Limpiar búsqueda',
                        onPressed: () {
                          _search.clear();
                          _load();
                        },
                      ),
              ),
            ),
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: FilterChip(
                label: const Text('Solo bajo el mínimo'),
                avatar: Icon(Icons.warning_amber_rounded, size: 18, color: t.warning),
                selected: _onlyLow,
                onSelected: (v) {
                  setState(() => _onlyLow = v);
                  _load();
                },
              ),
            ),
          ]),
        ),
        Expanded(child: _body(t)),
      ]),
    );
  }

  Widget _body(Tokens t) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return _Message(
        icon: Icons.cloud_off_outlined,
        text: _error!.message,
        action: FilledButton(onPressed: _load, child: const Text('Reintentar')),
      );
    }
    if (_items.isEmpty) {
      return _Message(
        icon: Icons.inventory_2_outlined,
        text: _onlyLow || _search.text.isNotEmpty ? 'Ningún insumo coincide con el filtro.' : 'Todavía no hay insumos.',
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        itemCount: _items.length + (_loadingMore ? 1 : 0),
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (_, i) {
          if (i >= _items.length) {
            return const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator()));
          }
          final it = _items[i];
          return Card(
            child: ListTile(
              onTap: () => _openMovement(it),
              title: Text(it.name, style: const TextStyle(fontWeight: FontWeight.w600)),
              subtitle: Text('Mínimo: ${it.minStock} ${it.unit}', style: TextStyle(color: t.muted)),
              trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('${it.stock} ${it.unit}',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: it.low ? t.negative : t.text)),
                if (it.low)
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: t.warningSoft,
                      border: Border.all(color: t.warningLine),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text('Bajo el mínimo', style: TextStyle(fontSize: 11, color: t.warningInk, fontWeight: FontWeight.w600)),
                  ),
              ]),
            ),
          );
        },
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.icon, required this.text, this.action});
  final IconData icon;
  final String text;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 44, color: t.muted),
          const SizedBox(height: 12),
          Text(text, textAlign: TextAlign.center, style: TextStyle(color: t.muted)),
          if (action != null) ...[const SizedBox(height: 16), SizedBox(width: 200, child: action)],
        ]),
      ),
    );
  }
}

class _MovementSheet extends ConsumerStatefulWidget {
  const _MovementSheet({required this.item});
  final InventoryItem item;

  @override
  ConsumerState<_MovementSheet> createState() => _MovementSheetState();
}

class _MovementSheetState extends ConsumerState<_MovementSheet> {
  final _qty = TextEditingController();
  final _reason = TextEditingController();
  String _type = 'in';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _qty.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final q = int.tryParse(_qty.text.trim());
    if (q == null || q < 1 || q > 100000) {
      setState(() => _error = 'Escribe una cantidad entera entre 1 y 100000.');
      return;
    }
    if (_type == 'out' && q > widget.item.stock) {
      setState(() => _error = 'Stock insuficiente: quedan ${widget.item.stock} ${widget.item.unit}.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final reason = _reason.text.trim();
      final data = await ref.read(apiClientProvider).send('POST', '/inventory-items/${widget.item.id}/movements', body: {
        'type': _type,
        'quantity': q,
        if (reason.isNotEmpty) 'reason': reason,
      });
      final raw = data is Map ? data['item'] : null;
      final updated = raw is Map
          ? InventoryItem.fromJson(Map<String, dynamic>.from(raw))
          : InventoryItem(
              id: widget.item.id,
              name: widget.item.name,
              unit: widget.item.unit,
              stock: widget.item.stock + (_type == 'in' ? q : -q),
              minStock: widget.item.minStock,
            );
      if (mounted) Navigator.of(context).pop(updated);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.field('quantity') ?? e.field('reason') ?? e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    final item = widget.item;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text(item.name, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text('Stock actual: ${item.stock} ${item.unit} · mínimo ${item.minStock}', style: TextStyle(color: t.muted)),
          const SizedBox(height: 16),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'in', label: Text('Entrada'), icon: Icon(Icons.add_circle_outline)),
              ButtonSegment(value: 'out', label: Text('Salida'), icon: Icon(Icons.remove_circle_outline)),
            ],
            selected: {_type},
            onSelectionChanged: (s) => setState(() => _type = s.first),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _qty,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(labelText: 'Cantidad (${item.unit})'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _reason,
            maxLength: 255,
            decoration: const InputDecoration(labelText: 'Motivo (opcional)'),
          ),
          if (_error != null) ...[
            Text(_error!, style: TextStyle(color: t.negative)),
            const SizedBox(height: 8),
          ],
          FilledButton(
            onPressed: _saving ? null : _submit,
            child: _saving
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : Text(_type == 'in' ? 'Registrar entrada' : 'Registrar salida'),
          ),
        ]),
      ),
    );
  }
}
