import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:legrandhotel_movil/core/api/api_client.dart';
import 'package:legrandhotel_movil/core/api/api_exception.dart';
import 'package:legrandhotel_movil/core/auth/auth_controller.dart';
import 'package:legrandhotel_movil/core/auth/models.dart';
import 'package:legrandhotel_movil/core/modules.dart';

import 'support/fakes.dart';

void main() {
  late FakeAdapter http;
  late MemoryStore store;
  late ProviderContainer container;

  ProviderContainer build() {
    final dio = Dio(BaseOptions(baseUrl: 'http://fake/api/v1'))..httpClientAdapter = http;
    final c = ProviderContainer(overrides: [
      apiClientProvider.overrideWithValue(ApiClient(dio: dio)),
      sessionStoreProvider.overrideWithValue(store),
    ]);
    addTearDown(c.dispose);
    return c;
  }

  Future<AuthController> ready() async {
    final notifier = container.read(authProvider.notifier);
    // Deja correr el arranque (lectura del almacenamiento seguro).
    for (var i = 0; i < 20 && container.read(authProvider).loading; i++) {
      await Future<void>.delayed(Duration.zero);
    }
    return notifier;
  }

  setUp(() {
    http = FakeAdapter();
    store = MemoryStore();
    container = build();
  });

  group('login', () {
    test('personal: guarda la sesión, el token y envía device_name', () async {
      http.json('POST /auth/login', 200, loginBody(['receptionist']));
      final auth = await ready();
      await auth.login('  ana@legrandhotel.test ', 'secreto');

      final s = container.read(authProvider);
      expect(s.session?.token, 'tok-1');
      expect(s.user?.mainRole, Role.receptionist);
      expect(store.saved?.token, 'tok-1');
      final sent = http.to('POST /auth/login').single.body as Map;
      expect(sent['email'], 'ana@legrandhotel.test', reason: 'se recorta el correo');
      expect(sent['device_name'], 'app-movil');
      expect(sent['password'], 'secreto');
    });

    test('envía el token en las llamadas posteriores', () async {
      http.json('POST /auth/login', 200, loginBody(['admin'], token: 'tok-admin'));
      http.json('GET /dashboard', 200, {'success': true, 'data': {}});
      final auth = await ready();
      await auth.login('a@b.c', 'x');
      await container.read(apiClientProvider).getOne('/dashboard');
      expect(http.requests.last.headers['Authorization'], 'Bearer tok-admin');
    });

    test('contraseña incorrecta: propaga attempts_left y no deja sesión', () async {
      http.json('POST /auth/login', 422, errorBody('INVALID_CREDENTIALS', 'Credenciales incorrectas.', {'attempts_left': 2}));
      final auth = await ready();
      await expectLater(
        auth.login('a@b.c', 'mala'),
        throwsA(isA<ApiException>().having((e) => e.attemptsLeft, 'attemptsLeft', 2).having((e) => e.code, 'code', 'INVALID_CREDENTIALS')),
      );
      expect(container.read(authProvider).session, isNull);
      expect(store.saved, isNull);
    });

    test('cuenta bloqueada: 429 LOGIN_LOCKED con retry_after', () async {
      http.json('POST /auth/login', 429, errorBody('LOGIN_LOCKED', 'Espera.', {'retry_after': 60}));
      final auth = await ready();
      await expectLater(
        auth.login('a@b.c', 'mala'),
        throwsA(isA<ApiException>().having((e) => e.status, 'status', 429).having((e) => e.retryAfter, 'retryAfter', 60)),
      );
      expect(container.read(authProvider).session, isNull);
    });

    test('cuenta cliente: se rechaza, se cierra el token en la API y no se guarda', () async {
      http.json('POST /auth/login', 200, loginBody(['client'], token: 'tok-cli'));
      http.json('POST /auth/logout', 200, {'success': true});
      final auth = await ready();
      await expectLater(auth.login('c@b.c', 'x'), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'NOT_STAFF')));
      expect(container.read(authProvider).session, isNull);
      expect(store.saved, isNull);
      final logout = http.to('POST /auth/logout').single;
      expect(logout.headers['Authorization'], 'Bearer tok-cli', reason: 'revoca el token recién creado');
      // Y ya no queda token puesto en el cliente.
      http.json('GET /x', 200, {'success': true, 'data': {}});
      await container.read(apiClientProvider).getOne('/x');
      expect(http.requests.last.headers.containsKey('Authorization'), isFalse);
    });
  });

  group('arranque, renovación y cierre', () {
    Session saved({Duration validFor = const Duration(hours: 4), List<Role> roles = const [Role.receptionist]}) => Session(
          token: 'tok-old',
          expiresAt: DateTime.now().add(validFor),
          user: AuthUser(id: 7, name: 'Ana', email: 'a@b.c', roles: roles),
        );

    test('sin sesión guardada: queda sin sesión y sin loading', () async {
      await ready();
      final s = container.read(authProvider);
      expect(s.loading, isFalse);
      expect(s.session, isNull);
    });

    test('sesión guardada vencida: se borra', () async {
      store = MemoryStore(saved(validFor: const Duration(hours: -1)));
      container = build();
      await ready();
      expect(container.read(authProvider).session, isNull);
      expect(store.saved, isNull);
    });

    test('sesión guardada válida: valida con /auth/me y renueva el token', () async {
      store = MemoryStore(saved());
      http.json('GET /auth/me', 200, {
        'success': true,
        'data': {'id': 7, 'name': 'Ana B', 'email': 'a@b.c', 'roles': [{'name': 'receptionist'}]},
      });
      http.json('POST /auth/refresh', 200, {
        'success': true,
        'data': {'token': 'tok-new', 'expires_at': DateTime.now().add(const Duration(hours: 8)).toIso8601String()},
      });
      container = build();
      await ready();
      for (var i = 0; i < 20 && container.read(authProvider).session?.token != 'tok-new'; i++) {
        await Future<void>.delayed(Duration.zero);
      }
      final s = container.read(authProvider).session!;
      expect(s.token, 'tok-new');
      expect(s.user.name, 'Ana B');
      expect(store.saved?.token, 'tok-new');
      expect(http.to('GET /auth/me').single.headers['Authorization'], 'Bearer tok-old');
    });

    test('refresh: el nuevo token se usa en las siguientes llamadas y se conserva el usuario', () async {
      http.json('POST /auth/login', 200, loginBody(['storekeeper']));
      http.json('POST /auth/refresh', 200, {
        'success': true,
        'data': {'token': 'tok-2', 'expires_at': DateTime.now().add(const Duration(hours: 8)).toIso8601String()},
      });
      final auth = await ready();
      await auth.login('a@b.c', 'x');
      await auth.refresh();
      final s = container.read(authProvider).session!;
      expect(s.token, 'tok-2');
      expect(s.user.mainRole, Role.storekeeper);
      expect(http.to('POST /auth/refresh').single.headers['Authorization'], 'Bearer tok-1');
    });

    test('refresh con 401: el evento de sesión vencida cierra la sesión', () async {
      http.json('POST /auth/login', 200, loginBody(['admin']));
      http.json('POST /auth/refresh', 401, errorBody('UNAUTHENTICATED', 'Vencida.'));
      final auth = await ready();
      await auth.login('a@b.c', 'x');
      await auth.refresh();
      await Future<void>.delayed(Duration.zero);
      expect(container.read(authProvider).session, isNull);
      expect(store.saved, isNull);
    });

    test('refresh sin red: se conserva la sesión', () async {
      http.json('POST /auth/login', 200, loginBody(['admin']));
      http.offline('POST /auth/refresh');
      final auth = await ready();
      await auth.login('a@b.c', 'x');
      await auth.refresh();
      expect(container.read(authProvider).session?.token, 'tok-1');
    });

    test('logout: llama a la API y borra la sesión local', () async {
      http.json('POST /auth/login', 200, loginBody(['admin']));
      http.json('POST /auth/logout', 200, {'success': true});
      final auth = await ready();
      await auth.login('a@b.c', 'x');
      await auth.logout();
      expect(http.to('POST /auth/logout'), hasLength(1));
      expect(container.read(authProvider).session, isNull);
      expect(store.saved, isNull);
    });

    test('logout sin red igual cierra la sesión local', () async {
      http.json('POST /auth/login', 200, loginBody(['admin']));
      http.offline('POST /auth/logout');
      final auth = await ready();
      await auth.login('a@b.c', 'x');
      await auth.logout();
      expect(container.read(authProvider).session, isNull);
      expect(store.saved, isNull);
    });
  });

  group('roles y pestañas (contra api/routes/api.php)', () {
    AuthUser u(List<Role> r) => AuthUser(id: 1, name: 'x', email: 'x@y.z', roles: r);
    List<String> labels(List<Role> r) => tabsFor(u(r)).map((t) => t.label).toList();

    test('cada rol ve solo lo que su API permite', () {
      expect(labels([Role.receptionist]), hasLength(2)); // Recepción + Cuenta
      expect(labels([Role.storekeeper]), hasLength(2)); // Almacén + Cuenta
      expect(labels([Role.developer]), hasLength(2)); // Panel + Cuenta
      expect(labels([Role.admin]), hasLength(4));
    });

    test('mainRole prioriza programador y administrador', () {
      expect(u([Role.receptionist, Role.admin]).mainRole, Role.admin);
      expect(u([Role.client]).isStaff, isFalse);
    });
  });
}
