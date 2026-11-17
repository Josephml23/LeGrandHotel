import 'package:flutter/material.dart';

import '../../core/module.dart';
import 'inventario_screen.dart';

/// Pestaña de almacén: Inventario con movimientos y alertas de stock.
final almacenTab = AppTab(
  id: 'almacen',
  label: 'Almacén',
  icon: Icons.inventory_2_outlined,
  selectedIcon: Icons.inventory_2,
  builder: (_) => const InventarioScreen(),
);
