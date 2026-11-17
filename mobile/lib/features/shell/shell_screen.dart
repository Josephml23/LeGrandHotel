import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/modules.dart';

/// Navegación inferior según el rol. Las pestañas salen de `core/modules.dart`.
class ShellScreen extends ConsumerStatefulWidget {
  const ShellScreen({super.key});

  @override
  ConsumerState<ShellScreen> createState() => _ShellScreenState();
}

class _ShellScreenState extends ConsumerState<ShellScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    if (user == null) return const SizedBox.shrink();
    final tabs = tabsFor(user);
    final index = _index.clamp(0, tabs.length - 1);
    return Scaffold(
      body: IndexedStack(index: index, children: [for (final t in tabs) Builder(key: ValueKey(t.id), builder: t.builder)]),
      bottomNavigationBar: tabs.length < 2
          ? null
          : NavigationBar(
              selectedIndex: index,
              onDestinationSelected: (i) => setState(() => _index = i),
              destinations: [
                for (final t in tabs) NavigationDestination(icon: Icon(t.icon), selectedIcon: Icon(t.selectedIcon ?? t.icon), label: t.label),
              ],
            ),
    );
  }
}
