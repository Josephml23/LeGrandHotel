/// Configuración de la app. La dirección de la API entra al compilar:
/// `flutter run --dart-define=API_URL=http://10.0.2.2:8000/api/v1`
class AppConfig {
  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'https://legrandhotel-api.onrender.com/api/v1',
  );

  /// Nombre del dispositivo que se envía en `device_name` al iniciar sesión.
  static const deviceName = 'app-movil';
}
