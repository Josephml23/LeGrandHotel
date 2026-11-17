import 'dart:async';

import 'package:dio/dio.dart';

import '../config.dart';
import 'api_exception.dart';

/// Cliente HTTP con el formato único de la API. Equivale a `web/src/lib/api.ts`.
/// Las pantallas de las otras tareas usan `getList`, `getOne` y `send`.
class ApiClient {
  ApiClient({Dio? dio})
      : dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.apiUrl,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 20),
              headers: {'Accept': 'application/json', 'Accept-Language': 'es'},
            )) {
    this.dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final t = _token;
        if (t != null) options.headers['Authorization'] = 'Bearer $t';
        handler.next(options);
      },
      onError: (e, handler) {
        final err = _toException(e);
        _emitFor(e, err);
        handler.reject(DioException(requestOptions: e.requestOptions, response: e.response, type: e.type, error: err));
      },
    ));
  }

  final Dio dio;
  String? _token;
  final _events = StreamController<ApiEvent>.broadcast();

  /// Eventos globales (sesión vencida, sin conexión, 403, 429, 5xx).
  Stream<ApiEvent> get events => _events.stream;

  void setToken(String? token) => _token = token;

  static const _authPublic = ['/auth/login', '/auth/register'];

  ApiException _toException(DioException e) {
    final res = e.response;
    if (res == null) {
      final offline = e.type == DioExceptionType.connectionError || e.type == DioExceptionType.unknown;
      return ApiException(0, offline ? 'OFFLINE' : 'NETWORK_ERROR', 'Sin conexión con el servidor.');
    }
    final data = res.data;
    final body = data is Map ? data['error'] : null;
    final details = body is Map ? body['details'] : null;
    return ApiException(
      res.statusCode ?? 0,
      body is Map && body['code'] is String ? body['code'] as String : 'HTTP_${res.statusCode}',
      body is Map && body['message'] is String ? body['message'] as String : 'Error inesperado.',
      details is Map ? Map<String, dynamic>.from(details) : null,
    );
  }

  void _emitFor(DioException e, ApiException err) {
    final method = e.requestOptions.method.toLowerCase();
    final path = e.requestOptions.path;
    final isRead = method == 'get';
    if (err.status == 0) {
      _events.add(err.code == 'OFFLINE' ? const OfflineEvent() : const ServiceUnavailableEvent('No se pudo contactar con el servidor.', 30));
      return;
    }
    final header = int.tryParse(e.response?.headers.value('retry-after') ?? '');
    final retry = header ?? (err.retryAfter > 0 ? err.retryAfter : 30);
    if (err.status == 401 && !_authPublic.any(path.endsWith)) {
      _events.add(const SessionExpiredEvent());
    } else if (err.status == 429 && !path.endsWith('/auth/login')) {
      _events.add(RateLimitedEvent(retry));
    } else if (err.status == 503) {
      _events.add(ServiceUnavailableEvent(err.message, retry));
    } else if (isRead && err.status == 403) {
      _events.add(const ForbiddenEvent());
    } else if (isRead && err.status >= 500) {
      _events.add(ServerErrorEvent(err.incidentId));
    }
  }

  Future<T> _run<T>(Future<T> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      final inner = e.error;
      throw inner is ApiException ? inner : _toException(e);
    }
  }

  /// Listado paginado: `{ data, meta }`.
  Future<PagedList<Map<String, dynamic>>> getList(String path, {Map<String, dynamic>? params}) => _run(() async {
        final res = await dio.get(path, queryParameters: _clean(params));
        final body = res.data as Map;
        return PagedList(
          (body['data'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList(),
          Map<String, dynamic>.from((body['meta'] as Map?) ?? const {}),
        );
      });

  /// Un solo objeto (`data`).
  Future<dynamic> getOne(String path, {Map<String, dynamic>? params}) => _run(() async {
        final res = await dio.get(path, queryParameters: _clean(params));
        return (res.data as Map)['data'];
      });

  /// Escritura (`post`, `put`, `patch`, `delete`); devuelve `data` o null.
  Future<dynamic> send(String method, String path, {Object? body}) => _run(() async {
        final res = await dio.request(path, data: body, options: Options(method: method.toUpperCase()));
        final d = res.data;
        return d is Map ? d['data'] : null;
      });

  static Map<String, dynamic>? _clean(Map<String, dynamic>? p) =>
      p == null ? null : (Map.of(p)..removeWhere((_, v) => v == null || v == ''));
}

class PagedList<T> {
  PagedList(this.data, this.meta);
  final List<T> data;
  final Map<String, dynamic> meta;
  int get lastPage => (meta['last_page'] as num?)?.toInt() ?? 1;
  int get total => (meta['total'] as num?)?.toInt() ?? data.length;
}
