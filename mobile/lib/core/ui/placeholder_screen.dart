import 'package:flutter/material.dart';

import '../theme.dart';

/// Pantalla provisional de un módulo. Cada tarea la reemplaza por la real.
class ModulePlaceholder extends StatelessWidget {
  const ModulePlaceholder({super.key, required this.title, required this.icon, required this.hint});

  final String title;
  final IconData icon;
  final String hint;

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 48, color: t.muted),
            const SizedBox(height: 16),
            Text('Próximamente', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(hint, textAlign: TextAlign.center, style: TextStyle(color: t.muted)),
          ]),
        ),
      ),
    );
  }
}
