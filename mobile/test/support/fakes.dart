import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:legrandhotel_movil/core/auth/models.dart';
import 'package:legrandhotel_movil/core/auth/session_store.dart';

/// Petición registrada por [FakeAdapter].
class Recorded {
  Recorded(this.method, this.path, this.headers, this.body);
  final String method;
  final String path;
  final Map<String, dynamic> headers;
  final Object? body;
}

/// Adaptador de Dio sin red: responde con lo que se haya programado por `METODO ruta`.
class FakeAdapter implements HttpClientAdapter {
  final Map<String, ResponseBody Function(RequestOptions)> routes = {};
  final List<Recorded> requests = [];

  void json(String key, int status, Object body, {Map<String, List<String>>? headers}) {
    routes[key] = (_) => ResponseBody.fromString(jsonEncode(body), status, headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
          ...?headers,
        });
  }

  /// Simula que no hay red (sin respuesta).
  void offline(String key) {
    routes[key] = (o) => throw DioException(requestOptions: o, type: DioExceptionType.connectionError);
  }

  Iterable<Recorded> to(String key) => requests.where((r) => '${r.method} ${r.path}' == key);

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    requests.add(Recorded(options.method, options.path, Map.of(options.headers), options.data));
    final h = routes['${options.method} ${options.path}'];
    if (h == null) {
      return ResponseBody.fromString(
          jsonEncode({'success': false, 'error': {'code': 'NOT_FOUND', 'message': 'sin ruta'}}), 404,
          headers: {Headers.contentTypeHeader: [Headers.jsonContentType]});
    }
    return h(options);
  }

  @override
  void close({bool force = false}) {}
}

/// Almacenamiento de sesión en memoria (sin Keystore).
class MemoryStore extends SessionStore {
  MemoryStore([this.saved]);
  Session? saved;
  int clears = 0;

  @override
  Future<Session?> read() async => saved;
  @override
  Future<void> write(Session s) async => saved = s;
  @override
  Future<void> clear() async {
    saved = null;
    clears++;
  }
}

Map<String, dynamic> loginBody(List<String> roles, {String token = 'tok-1', String? expiresAt}) => {
      'success': true,
      'data': {
        'token': token,
        'expires_at': expiresAt ?? DateTime.now().add(const Duration(hours: 8)).toIso8601String(),
        'user': {
          'id': 7,
          'name': 'Ana',
          'email': 'ana@legrandhotel.test',
          'roles': [for (final r in roles) {'name': r}],
        },
      },
    };

Map<String, dynamic> errorBody(String code, String message, [Map<String, dynamic>? details]) => {
      'success': false,
      'error': {'code': code, 'message': message, 'details': ?details},
    };
