import 'package:flutter/material.dart';

import '../../core/module.dart';
import 'panel_screen.dart';

/// Pestaña del panel resumido (`/dashboard`, `/reports/occupancy`).
final panelTab = AppTab(
  id: 'panel',
  label: 'Panel',
  icon: Icons.insights_outlined,
  selectedIcon: Icons.insights,
  builder: (_) => const PanelScreen(),
);
