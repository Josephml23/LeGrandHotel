import '../features/almacen/almacen_module.dart';
import '../features/cuenta/cuenta_screen.dart';
import '../features/panel/panel_module.dart';
import '../features/recepcion/recepcion_module.dart';
import 'auth/models.dart';
import 'module.dart';

/// Pestañas por rol. Las rutas de la API que manda cada rol están en `api/routes/api.php`:
/// recepción = admin + receptionist; almacén = admin + storekeeper; panel = admin + developer (+ resumen).
/// La pestaña «Cuenta» siempre va al final.
List<AppTab> tabsFor(AuthUser user) {
  final tabs = <AppTab>[];
  if (user.hasRole(Role.admin) || user.hasRole(Role.receptionist)) tabs.add(recepcionTab);
  if (user.hasRole(Role.admin) || user.hasRole(Role.storekeeper)) tabs.add(almacenTab);
  if (user.hasRole(Role.admin) || user.hasRole(Role.developer)) tabs.add(panelTab);
  tabs.add(cuentaTab);
  return tabs;
}
