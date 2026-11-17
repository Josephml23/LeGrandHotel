import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/config.dart';
import '../../core/module.dart';
import '../../core/theme.dart';

final cuentaTab = AppTab(
  id: 'cuenta',
  label: 'Cuenta',
  icon: Icons.person_outline,
  selectedIcon: Icons.person,
  builder: (_) => const CuentaScreen(),
);

class CuentaScreen extends ConsumerWidget {
  const CuentaScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final t = Tokens.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Cuenta')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(user?.name ?? '', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 4),
              Text(user?.email ?? '', style: TextStyle(color: t.muted)),
              const SizedBox(height: 12),
              Wrap(spacing: 8, children: [
                for (final r in user?.roles ?? const []) Chip(label: Text(r.label), backgroundColor: t.accentTint, side: BorderSide.none),
              ]),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: () => ref.read(authProvider.notifier).logout(),
          icon: const Icon(Icons.logout),
          label: const Text('Cerrar sesión'),
        ),
        const SizedBox(height: 24),
        Text('Servidor: ${AppConfig.apiUrl}', style: TextStyle(color: t.muted, fontSize: 12)),
      ]),
    );
  }
}
