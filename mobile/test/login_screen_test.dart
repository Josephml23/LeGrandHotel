import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:legrandhotel_movil/core/api/api_client.dart';
import 'package:legrandhotel_movil/core/auth/auth_controller.dart';
import 'package:legrandhotel_movil/core/theme.dart';
import 'package:legrandhotel_movil/features/auth/login_screen.dart';

import 'support/fakes.dart';

void main() {
  late FakeAdapter http;

  Future<void> mount(WidgetTester tester) async {
    http = FakeAdapter();
    final dio = Dio(BaseOptions(baseUrl: 'http://fake/api/v1'))..httpClientAdapter = http;
    await tester.pumpWidget(ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(ApiClient(dio: dio)),
        sessionStoreProvider.overrideWithValue(MemoryStore()),
      ],
      child: MaterialApp(theme: buildTheme(Brightness.light), home: const LoginScreen()),
    ));
  }

  Future<void> submit(WidgetTester tester) async {
    await tester.enterText(find.byType(TextField).at(0), 'ana@legrandhotel.test');
    await tester.enterText(find.byType(TextField).at(1), 'mala');
    await tester.tap(find.widgetWithText(FilledButton, 'Ingresar'));
    // Deja correr los temporizadores y microtareas de Dio dentro del reloj falso.
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 10));
    }
  }

  testWidgets('avisa cuántos intentos quedan', (tester) async {
    await mount(tester);
    http.json('POST /auth/login', 422, errorBody('INVALID_CREDENTIALS', 'Credenciales incorrectas.', {'attempts_left': 2}));
    await submit(tester);
    expect(find.text('Credenciales incorrectas.'), findsOneWidget);
    expect(find.text('Te quedan 2 intentos antes de que haya que esperar.'), findsOneWidget);
  });

  testWidgets('con 1 intento usa el singular', (tester) async {
    await mount(tester);
    http.json('POST /auth/login', 422, errorBody('INVALID_CREDENTIALS', 'Credenciales incorrectas.', {'attempts_left': 1}));
    await submit(tester);
    expect(find.text('Te queda 1 intento antes de que haya que esperar.'), findsOneWidget);
  });

  testWidgets('429 LOGIN_LOCKED: cuenta regresiva, botón bloqueado y se libera al llegar a 0', (tester) async {
    await mount(tester);
    http.json('POST /auth/login', 429, errorBody('LOGIN_LOCKED', 'Espera.', {'retry_after': 3}));
    await submit(tester);
    expect(find.textContaining('espera 3 s'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Espera 3 s'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNull);

    await tester.pump(const Duration(seconds: 1));
    expect(find.widgetWithText(FilledButton, 'Espera 2 s'), findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
    expect(find.widgetWithText(FilledButton, 'Ingresar'), findsOneWidget);
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNotNull);
  });

  testWidgets('cuenta de cliente: muestra que la app es solo para el personal', (tester) async {
    await mount(tester);
    http.json('POST /auth/login', 200, loginBody(['client']));
    http.json('POST /auth/logout', 200, {'success': true});
    await submit(tester);
    expect(find.text('Esta app es solo para el personal del hotel.'), findsOneWidget);
  });

  testWidgets('sin conexión: mensaje de red', (tester) async {
    await mount(tester);
    http.offline('POST /auth/login');
    await submit(tester);
    expect(find.textContaining('No se pudo contactar con el servidor'), findsOneWidget);
  });
}
