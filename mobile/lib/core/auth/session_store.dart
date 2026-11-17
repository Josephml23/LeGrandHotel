import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'models.dart';

/// Guarda la sesión en el Keystore (Android) o el Keychain (iOS); nunca en texto plano.
class SessionStore {
  SessionStore([FlutterSecureStorage? storage])
      : _s = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _s;
  static const _kToken = 'lgh.token';
  static const _kExpires = 'lgh.expires_at';
  static const _kUser = 'lgh.user';

  Future<Session?> read() async {
    try {
      final token = await _s.read(key: _kToken);
      final user = await _s.read(key: _kUser);
      if (token == null || user == null) return null;
      final exp = await _s.read(key: _kExpires);
      return Session(
        token: token,
        expiresAt: exp == null || exp.isEmpty ? null : DateTime.tryParse(exp),
        user: AuthUser.fromJson(jsonDecode(user) as Map<String, dynamic>),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> write(Session s) async {
    await _s.write(key: _kToken, value: s.token);
    await _s.write(key: _kExpires, value: s.expiresAt?.toIso8601String() ?? '');
    await _s.write(key: _kUser, value: jsonEncode(s.user.toJson()));
  }

  Future<void> clear() async {
    await _s.delete(key: _kToken);
    await _s.delete(key: _kExpires);
    await _s.delete(key: _kUser);
  }
}
