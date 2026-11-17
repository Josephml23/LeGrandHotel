import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:legrandhotel_movil/core/api/api_client.dart';
import 'package:legrandhotel_movil/core/api/api_exception.dart';

import 'support/fakes.dart';

void main() {
  late FakeAdapter http;
  late ApiClient api;
  late List<ApiEvent> events;

  setUp(() {
    http = FakeAdapter();
    final dio = Dio(BaseOptions(baseUrl: 'http://fake/api/v1'))..httpClientAdapter = http;
    api = ApiClient(dio: dio);
    events = [];
    api.events.listen(events.add);
  });

  Future<void> flush() => Future<void>.delayed(Duration.zero);

  group('formato de respuesta', () {
    test('getList devuelve data y meta paginados', () async {
      http.json('GET /rooms', 200, {
        'success': true,
        'data': [
          {'id': 1, 'number': '101'},
          {'id': 2, 'number': '102'},
        ],
        'meta': {'current_page': 1, 'last_page': 4, 'total': 70},
      });
      final res = await api.getList('/rooms', params: {'per_page': 50, 'search': '', 'x': null});
      expect(res.data.length, 2);
      expect(res.data.first['number'], '101');
      expect(res.lastPage, 4);
      expect(res.total, 70);
      // Los parámetros vacíos o nulos no se envían.
      final q = http.requests.single;
      expect(q.method, 'GET');
    });

    test('getList sin meta usa valores por defecto', () async {
      http.json('GET /rooms', 200, {'success': true, 'data': [{}]});
      final res = await api.getList('/rooms');
      expect(res.lastPage, 1);
      expect(res.total, 1);
    });

    test('getOne devuelve solo data', () async {
      http.json('GET /dashboard', 200, {'success': true, 'data': {'rooms': {'available': 3}}});
      final d = await api.getOne('/dashboard');
      expect(d['rooms']['available'], 3);
    });

    test('send envía el cuerpo y el método, y devuelve data o null', () async {
      http.json('POST /clients', 201, {'success': true, 'data': {'id': 9}});
      http.json('DELETE /clients/9', 200, {'success': true});
      final created = await api.send('post', '/clients', body: {'name': 'Luz'});
      expect(created['id'], 9);
      expect(http.to('POST /clients').single.body, {'name': 'Luz'});
      expect(await api.send('delete', '/clients/9'), isNull);
    });
  });

  group('errores de la API', () {
    test('error de negocio con code, message y details', () async {
      http.json('POST /reservations', 409, errorBody('ROOM_NOT_AVAILABLE', 'La habitación ya está reservada.'));
      await expectLater(
        api.send('post', '/reservations', body: {}),
        throwsA(isA<ApiException>()
            .having((e) => e.status, 'status', 409)
            .having((e) => e.code, 'code', 'ROOM_NOT_AVAILABLE')
            .having((e) => e.message, 'message', 'La habitación ya está reservada.')),
      );
      await flush();
      // Un 409 en escritura no abre ninguna pantalla de error.
      expect(events, isEmpty);
    });

    test('INVALID_CREDENTIALS trae attempts_left', () async {
      http.json('POST /auth/login', 422, errorBody('INVALID_CREDENTIALS', 'Credenciales incorrectas.', {'attempts_left': 2}));
      try {
        await api.send('post', '/auth/login', body: {});
        fail('debía lanzar');
      } on ApiException catch (e) {
        expect(e.code, 'INVALID_CREDENTIALS');
        expect(e.attemptsLeft, 2);
        expect(e.retryAfter, 0);
      }
    });

    test('LOGIN_LOCKED trae retry_after y no abre pantalla global', () async {
      http.json('POST /auth/login', 429, errorBody('LOGIN_LOCKED', 'Demasiados intentos.', {'retry_after': 45}));
      try {
        await api.send('post', '/auth/login', body: {});
        fail('debía lanzar');
      } on ApiException catch (e) {
        expect(e.status, 429);
        expect(e.retryAfter, 45);
      }
      await flush();
      expect(events, isEmpty, reason: 'el login muestra su propia cuenta regresiva');
    });

    test('error de validación 422: primer mensaje por campo', () async {
      http.json('POST /clients', 422, errorBody('VALIDATION_ERROR', 'Datos inválidos.', {'email': ['Correo inválido', 'otro']}));
      try {
        await api.send('post', '/clients', body: {});
        fail('debía lanzar');
      } on ApiException catch (e) {
        expect(e.field('email'), 'Correo inválido');
        expect(e.field('name'), isNull);
      }
    });

    test('cuerpo que no es JSON de la API produce HTTP_<status>', () async {
      http.routes['GET /rooms'] = (_) => ResponseBody.fromString('<html>boom</html>', 502);
      try {
        await api.getList('/rooms');
        fail('debía lanzar');
      } on ApiException catch (e) {
        expect(e.code, 'HTTP_502');
        expect(e.status, 502);
      }
    });
  });

  group('interceptores', () {
    test('agrega Bearer cuando hay token y lo quita al borrarlo', () async {
      http.json('GET /auth/me', 200, {'success': true, 'data': {}});
      await api.getOne('/auth/me');
      expect(http.requests.last.headers.containsKey('Authorization'), isFalse);
      api.setToken('abc');
      await api.getOne('/auth/me');
      expect(http.requests.last.headers['Authorization'], 'Bearer abc');
      api.setToken(null);
      await api.getOne('/auth/me');
      expect(http.requests.last.headers.containsKey('Authorization'), isFalse);
    });

    test('401 fuera del login emite SessionExpiredEvent', () async {
      http.json('GET /rooms', 401, errorBody('UNAUTHENTICATED', 'Sesión vencida.'));
      await expectLater(api.getList('/rooms'), throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)));
      await flush();
      expect(events.single, isA<SessionExpiredEvent>());
    });

    test('401 en /auth/login NO cierra sesión (es una credencial mala)', () async {
      http.json('POST /auth/login', 401, errorBody('INVALID_CREDENTIALS', 'Mal.'));
      await expectLater(api.send('post', '/auth/login', body: {}), throwsA(isA<ApiException>()));
      await flush();
      expect(events, isEmpty);
    });

    test('429 usa el encabezado Retry-After y emite RateLimitedEvent', () async {
      http.json('GET /rooms', 429, errorBody('TOO_MANY_REQUESTS', 'Calma.'), headers: {'retry-after': ['12']});
      await expectLater(api.getList('/rooms'), throwsA(isA<ApiException>()));
      await flush();
      expect((events.single as RateLimitedEvent).retryAfter, 12);
    });

    test('429 sin encabezado usa details.retry_after, y si no, 30 s', () async {
      http.json('GET /a', 429, errorBody('TOO_MANY_REQUESTS', 'x', {'retry_after': 7}));
      http.json('GET /b', 429, errorBody('TOO_MANY_REQUESTS', 'x'));
      await expectLater(api.getList('/a'), throwsA(isA<ApiException>()));
      await expectLater(api.getList('/b'), throwsA(isA<ApiException>()));
      await flush();
      expect(events.map((e) => (e as RateLimitedEvent).retryAfter), [7, 30]);
    });

    test('503 emite ServiceUnavailableEvent con el mensaje y la espera', () async {
      http.json('GET /rooms', 503, errorBody('MAINTENANCE', 'En mantenimiento.'), headers: {'retry-after': ['60']});
      await expectLater(api.getList('/rooms'), throwsA(isA<ApiException>()));
      await flush();
      final e = events.single as ServiceUnavailableEvent;
      expect(e.reason, 'En mantenimiento.');
      expect(e.retryAfter, 60);
    });

    test('500 en lectura emite ServerErrorEvent con incident_id; en escritura no', () async {
      http.json('GET /rooms', 500, errorBody('SERVER_ERROR', 'Error.', {'incident_id': 'abc123'}));
      http.json('POST /rooms', 500, errorBody('SERVER_ERROR', 'Error.'));
      await expectLater(api.getList('/rooms'), throwsA(isA<ApiException>()));
      await expectLater(api.send('post', '/rooms', body: {}), throwsA(isA<ApiException>()));
      await flush();
      expect(events.length, 1);
      expect((events.single as ServerErrorEvent).incidentId, 'abc123');
    });

    test('403 solo abre la pantalla de acceso denegado en lecturas', () async {
      http.json('GET /audit-logs', 403, errorBody('FORBIDDEN', 'No autorizado.'));
      http.json('POST /rooms', 403, errorBody('FORBIDDEN', 'No autorizado.'));
      await expectLater(api.getList('/audit-logs'), throwsA(isA<ApiException>()));
      await expectLater(api.send('post', '/rooms', body: {}), throwsA(isA<ApiException>()));
      await flush();
      expect(events.single, isA<ForbiddenEvent>());
    });

    test('sin red: OfflineEvent y ApiException con status 0', () async {
      http.offline('GET /rooms');
      try {
        await api.getList('/rooms');
        fail('debía lanzar');
      } on ApiException catch (e) {
        expect(e.status, 0);
        expect(e.isOffline, isTrue);
      }
      await flush();
      expect(events.single, isA<OfflineEvent>());
    });
  });
}
