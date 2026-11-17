import 'package:flutter/material.dart';

import 'cochera_tab.dart';
import 'habitaciones_tab.dart';
import 'hoy_tab.dart';
import 'reservar_tab.dart';

/// Raíz de Recepción: cuatro secciones en un TabBar.
class RecepcionScreen extends StatefulWidget {
  const RecepcionScreen({super.key});

  @override
  State<RecepcionScreen> createState() => _RecepcionScreenState();
}

class _RecepcionScreenState extends State<RecepcionScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 4, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Recepción'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Hoy'),
            Tab(text: 'Reservar'),
            Tab(text: 'Habitaciones'),
            Tab(text: 'Cochera'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          const HoyTab(),
          ReservarTab(onCreated: () => _tabs.animateTo(0)),
          const HabitacionesTab(),
          const CocheraTab(),
        ],
      ),
    );
  }
}
