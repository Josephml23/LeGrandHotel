
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/login_screen.dart';
import '../features/errores/error_screen.dart';
import '../features/shell/shell_screen.dart';
import 'api/api_exception.dart';
import 'auth/auth_controller.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(authProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  final router = GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final loc = state.matchedLocation;
      if (auth.loading) return loc == '/splash' ? null : '/splash';
      final logged = auth.session != null;
      if (loc == '/splash') return logged ? '/' : '/login';
      if (loc.startsWith('/error')) return null;
      if (!logged) return loc == '/login' ? null : '/login';
      if (loc == '/login') return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const Scaffold(body: Center(child: CircularProgressIndicator()))),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/', builder: (_, _) => const ShellScreen()),
      GoRoute(
        path: '/error/:kind',
        builder: (_, state) => ErrorScreen(
          kind: errorKindFromName(state.pathParameters['kind']) ?? ErrorKind.server,
          wait: int.tryParse(state.uri.queryParameters['wait'] ?? '') ?? 0,
          incidentId: state.uri.queryParameters['incident'],
        ),
      ),
    ],
  );

  // Los eventos globales de la API abren la pantalla de error que corresponda.
  final sub = ref.read(apiClientProvider).events.listen((e) {
    final loc = router.state.matchedLocation;
    if (loc.startsWith('/error')) return;
    switch (e) {
      case OfflineEvent():
        router.go('/error/offline');
      case SessionExpiredEvent():
        router.go('/error/session');
      case ForbiddenEvent():
        router.go('/error/forbidden');
      case RateLimitedEvent(:final retryAfter):
        router.go('/error/rateLimited?wait=$retryAfter');
      case ServerErrorEvent(:final incidentId):
        router.go('/error/server${incidentId == null ? '' : '?incident=${Uri.encodeComponent(incidentId)}'}');
      case ServiceUnavailableEvent(:final retryAfter):
        router.go('/error/unavailable?wait=$retryAfter');
    }
  });
  ref.onDispose(sub.cancel);
  return router;
});
