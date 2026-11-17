/// Error de la API con el formato `{ success:false, error:{ code, message, details } }`.
/// `status == 0` significa que no hubo respuesta (sin conexión o servidor caído).
class ApiException implements Exception {
  ApiException(this.status, this.code, this.message, [this.details]);

  final int status;
  final String code;
  final String message;
  final Map<String, dynamic>? details;

  bool get isOffline => code == 'OFFLINE' || code == 'NETWORK_ERROR';

  /// Segundos de espera pedidos por la API (429 `LOGIN_LOCKED`, 503…).
  int get retryAfter {
    final v = details?['retry_after'];
    return v is num ? v.toInt() : int.tryParse('$v') ?? 0;
  }

  /// Intentos de login que quedan antes de la espera (`INVALID_CREDENTIALS`).
  int get attemptsLeft {
    final v = details?['attempts_left'];
    return v is num ? v.toInt() : int.tryParse('$v') ?? 0;
  }

  String? get incidentId => details?['incident_id']?.toString();

  /// Primer mensaje de validación (422) de un campo.
  String? field(String name) {
    final v = details?[name];
    return v is List && v.isNotEmpty ? '${v.first}' : null;
  }

  @override
  String toString() => 'ApiException($status, $code, $message)';
}

/// Eventos globales que la navegación convierte en pantallas de error.
sealed class ApiEvent {
  const ApiEvent();
}

class OfflineEvent extends ApiEvent {
  const OfflineEvent();
}

class SessionExpiredEvent extends ApiEvent {
  const SessionExpiredEvent();
}

class ForbiddenEvent extends ApiEvent {
  const ForbiddenEvent();
}

class RateLimitedEvent extends ApiEvent {
  const RateLimitedEvent(this.retryAfter);
  final int retryAfter;
}

class ServerErrorEvent extends ApiEvent {
  const ServerErrorEvent(this.incidentId);
  final String? incidentId;
}

class ServiceUnavailableEvent extends ApiEvent {
  const ServiceUnavailableEvent(this.reason, this.retryAfter);
  final String reason;
  final int retryAfter;
}
