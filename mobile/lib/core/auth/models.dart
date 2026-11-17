/// Roles de la API (`web/src/types.ts`).
enum Role {
  admin('admin', 'Administrador'),
  receptionist('receptionist', 'Recepcionista'),
  storekeeper('storekeeper', 'Almacenero'),
  developer('developer', 'Programador'),
  client('client', 'Cliente');

  const Role(this.apiName, this.label);
  final String apiName;
  final String label;

  static Role? parse(String? name) {
    for (final r in Role.values) {
      if (r.apiName == name) return r;
    }
    return null;
  }

  bool get isStaff => this != Role.client;
}

class AuthUser {
  AuthUser({required this.id, required this.name, required this.email, required this.roles});

  final int id;
  final String name;
  final String email;
  final List<Role> roles;

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: (j['id'] as num).toInt(),
        name: '${j['name'] ?? ''}',
        email: '${j['email'] ?? ''}',
        roles: [for (final r in (j['roles'] as List? ?? const [])) ?Role.parse(r is Map ? r['name'] as String? : '$r')],
      );

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'email': email, 'roles': [for (final r in roles) r.apiName]};

  bool hasRole(Role r) => roles.contains(r);
  bool get isStaff => roles.any((r) => r.isStaff);

  /// Rol que se muestra primero en la UI.
  Role? get mainRole {
    const order = [Role.developer, Role.admin, Role.receptionist, Role.storekeeper, Role.client];
    for (final r in order) {
      if (roles.contains(r)) return r;
    }
    return null;
  }
}

class Session {
  Session({required this.token, required this.expiresAt, required this.user});

  final String token;
  final DateTime? expiresAt;
  final AuthUser user;

  factory Session.fromJson(Map<String, dynamic> j, {AuthUser? fallbackUser}) => Session(
        token: j['token'] as String,
        expiresAt: j['expires_at'] == null ? null : DateTime.tryParse('${j['expires_at']}'),
        user: j['user'] is Map ? AuthUser.fromJson(Map<String, dynamic>.from(j['user'] as Map)) : fallbackUser!,
      );

  Session copyWith({AuthUser? user}) => Session(token: token, expiresAt: expiresAt, user: user ?? this.user);

  bool get expired => expiresAt != null && expiresAt!.isBefore(DateTime.now());
}
