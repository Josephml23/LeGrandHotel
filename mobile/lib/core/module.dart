import 'package:flutter/material.dart';

/// Una pestaña de la navegación inferior. Cada módulo (recepción, almacén, panel) aporta la suya
/// desde su carpeta en `lib/features/<modulo>/<modulo>_module.dart` sin tocar el núcleo.
/// Dentro de su pantalla raíz, el módulo es libre de usar su propia navegación (TabBar, Navigator.push…).
class AppTab {
  const AppTab({
    required this.id,
    required this.label,
    required this.icon,
    required this.builder,
    this.selectedIcon,
  });

  final String id;
  final String label;
  final IconData icon;
  final IconData? selectedIcon;
  final WidgetBuilder builder;
}
