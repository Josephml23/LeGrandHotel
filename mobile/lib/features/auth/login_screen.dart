import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme.dart';

/// Login del personal (correo + contraseña). Los tres primeros fallos solo avisan cuántos intentos
/// quedan; después la API responde 429 `LOGIN_LOCKED` con `retry_after` y se muestra la cuenta regresiva.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _busy = false;
  String? _error;
  String? _emailError;
  int _attemptsLeft = 0;
  int _remaining = 0;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _startCountdown(int seconds) {
    _timer?.cancel();
    setState(() => _remaining = seconds);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      setState(() => _remaining = _remaining - 1);
      if (_remaining <= 0) t.cancel();
    });
  }

  Future<void> _submit() async {
    if (_busy || _remaining > 0) return;
    setState(() {
      _busy = true;
      _error = null;
      _emailError = null;
      _attemptsLeft = 0;
    });
    try {
      await ref.read(authProvider.notifier).login(_email.text, _password.text);
      // El router redirige al inicio al haber sesión.
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _emailError = e.field('email');
        if (e.code == 'LOGIN_LOCKED') {
          _error = null;
        } else if (e.isOffline) {
          _error = 'No se pudo contactar con el servidor. Revisa tu conexión.';
        } else {
          _error = e.message;
        }
        if (e.code == 'INVALID_CREDENTIALS') _attemptsLeft = e.attemptsLeft;
      });
      if (e.retryAfter > 0) _startCountdown(e.retryAfter);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Tokens.of(context);
    final locked = _remaining > 0;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: AutofillGroup(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text('LeGrandHotel', style: TextStyle(color: t.accent, fontWeight: FontWeight.w700, fontSize: 16)),
                  const SizedBox(height: 12),
                  Text('Iniciar sesión', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text('Personal del hotel: ingresa con tu correo y contraseña.', style: TextStyle(color: t.muted)),
                  const SizedBox(height: 20),
                  if (_error != null) _Banner(text: _error!, color: t.negative, background: t.surface, border: t.negative),
                  if (locked)
                    _Banner(
                      text: 'Por seguridad, espera $_remaining s antes de volver a intentar. Cada intento fallido alarga la espera.',
                      color: t.warningInk,
                      background: t.warningSoft,
                      border: t.warningLine,
                    ),
                  if (!locked && _attemptsLeft > 0)
                    _Banner(
                      text: _attemptsLeft == 1
                          ? 'Te queda 1 intento antes de que haya que esperar.'
                          : 'Te quedan $_attemptsLeft intentos antes de que haya que esperar.',
                      color: t.warningInk,
                      background: t.warningSoft,
                      border: t.warningLine,
                    ),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.username],
                    textInputAction: TextInputAction.next,
                    decoration: InputDecoration(labelText: 'Correo', errorText: _emailError),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: _password,
                    obscureText: _obscure,
                    autofillHints: const [AutofillHints.password],
                    onSubmitted: (_) => _submit(),
                    decoration: InputDecoration(
                      labelText: 'Contraseña',
                      suffixIcon: IconButton(
                        tooltip: _obscure ? 'Mostrar contraseña' : 'Ocultar contraseña',
                        icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: (_busy || locked) ? null : _submit,
                    child: Text(_busy ? 'Ingresando…' : locked ? 'Espera $_remaining s' : 'Ingresar'),
                  ),
                  const SizedBox(height: 16),
                  Text('Las cuentas del personal las crea el Administrador.', textAlign: TextAlign.center, style: TextStyle(color: t.muted, fontSize: 12)),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.text, required this.color, required this.background, required this.border});
  final String text;
  final Color color, background, border;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: background, border: Border.all(color: border), borderRadius: BorderRadius.circular(radiusControl)),
        child: Semantics(liveRegion: true, child: Text(text, style: TextStyle(color: color))),
      );
}
