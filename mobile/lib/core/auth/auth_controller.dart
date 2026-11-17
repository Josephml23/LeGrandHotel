import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../config.dart';
import 'models.dart';
import 'session_store.dart';

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());
final sessionStoreProvider = Provider<SessionStore>((ref) => SessionStore());

/// Estado de autenticación. `loading` solo al arrancar, mientras se lee el almacenamiento seguro.
class AuthState {
  const AuthState({this.session, this.loading = true});
  final Session? session;
  final bool loading;
  AuthUser? get user => session?.user;
}

final authProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

/// Rol del personal con sesión iniciada (null si no hay sesión).
final currentRoleProvider = Provider<Role?>((ref) => ref.watch(authProvider).user?.mainRole);

class AuthController extends Notifier<AuthState> {
  Timer? _renewTimer;
  StreamSubscription<ApiEvent>? _sub;

  ApiClient get _api => ref.read(apiClientProvider);
  SessionStore get _store => ref.read(sessionStoreProvider);

  @override
  AuthState build() {
    ref.onDispose(() {
      _renewTimer?.cancel();
      _sub?.cancel();
    });
    _sub = _api.events.listen((e) {
      if (e is SessionExpiredEvent) _drop();
    });
    Future.microtask(_bootstrap);
    return const AuthState();
  }

  Future<void> _bootstrap() async {
    final saved = await _store.read();
    if (saved == null || saved.expired || !saved.user.isStaff) {
      await _store.clear();
      state = const AuthState(loading: false);
      return;
    }
    _api.setToken(saved.token);
    state = AuthState(session: saved, loading: false);
    // Valida el token y renueva: si la API lo rechaza, el evento 401 cierra la sesión.
    try {
      final me = await _api.getOne('/auth/me');
      final user = AuthUser.fromJson(Map<String, dynamic>.from(me as Map));
      if (!user.isStaff) {
        await _drop();
        return;
      }
      await _apply(saved.copyWith(user: user));
      await refresh();
    } on ApiException {
      // Sin conexión: se conserva la sesión guardada; las pantallas mostrarán el error.
    }
  }

  Future<void> _apply(Session s) async {
    _api.setToken(s.token);
    await _store.write(s);
    state = AuthState(session: s, loading: false);
    _scheduleRenew(s);
  }

  void _scheduleRenew(Session s) {
    _renewTimer?.cancel();
    final exp = s.expiresAt;
    if (exp == null) return;
    var wait = exp.difference(DateTime.now()) - const Duration(minutes: 5);
    if (wait < const Duration(seconds: 30)) wait = const Duration(seconds: 30);
    _renewTimer = Timer(wait, () => refresh());
  }

  /// `POST /auth/login`. Lanza [ApiException]: `INVALID_CREDENTIALS` trae `attemptsLeft`,
  /// `LOGIN_LOCKED` (429) trae `retryAfter`.
  Future<void> login(String email, String password) async {
    final data = await _api.send('post', '/auth/login', body: {
      'email': email.trim(),
      'password': password,
      'device_name': AppConfig.deviceName,
    });
    final session = Session.fromJson(Map<String, dynamic>.from(data as Map));
    if (!session.user.isStaff) {
      // Los clientes entran solo con Google (fuera de alcance de esta app).
      try {
        _api.setToken(session.token);
        await _api.send('post', '/auth/logout');
      } catch (_) {}
      _api.setToken(null);
      throw ApiException(403, 'NOT_STAFF', 'Esta app es solo para el personal del hotel.');
    }
    await _apply(session);
  }

  /// `POST /auth/refresh`: cambia el token por uno nuevo.
  Future<void> refresh() async {
    final current = state.session;
    if (current == null) return;
    try {
      final data = await _api.send('post', '/auth/refresh');
      await _apply(Session.fromJson(Map<String, dynamic>.from(data as Map), fallbackUser: current.user));
    } on ApiException {
      // 401 ya cerró la sesión; otros errores se reintentan en el siguiente ciclo.
    }
  }

  /// `POST /auth/logout` y borrado del token local.
  Future<void> logout() async {
    try {
      await _api.send('post', '/auth/logout');
    } on ApiException {
      // Aunque falle la red, la sesión local se cierra.
    }
    await _drop();
  }

  Future<void> _drop() async {
    _renewTimer?.cancel();
    _api.setToken(null);
    await _store.clear();
    state = const AuthState(loading: false);
  }
}
