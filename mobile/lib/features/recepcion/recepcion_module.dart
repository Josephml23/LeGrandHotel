import 'package:flutter/material.dart';

import '../../core/module.dart';
import 'recepcion_screen.dart';

/// Pestaña de Recepción: Hoy, Reservar, Habitaciones y Cochera (tarea M2).
final recepcionTab = AppTab(
  id: 'recepcion',
  label: 'Recepción',
  icon: Icons.meeting_room_outlined,
  selectedIcon: Icons.meeting_room,
  builder: (_) => const RecepcionScreen(),
);
