import 'package:flutter/material.dart';

/// Tokens de `web/src/styles.css` (claro y oscuro).
class Tokens {
  const Tokens({
    required this.ground,
    required this.surface,
    required this.raised,
    required this.border,
    required this.text,
    required this.muted,
    required this.accent,
    required this.accentInk,
    required this.accentTint,
    required this.positive,
    required this.negative,
    required this.warning,
    required this.warningSoft,
    required this.warningLine,
    required this.warningInk,
    required this.onText,
  });

  final Color ground, surface, raised, border, text, muted, accent, accentInk, accentTint;
  final Color positive, negative, warning, warningSoft, warningLine, warningInk, onText;

  static const light = Tokens(
    ground: Color(0xFFF6F5F2),
    surface: Color(0xFFFFFFFF),
    raised: Color(0xFFF4F4F1),
    border: Color(0xFFE6E5E1),
    text: Color(0xFF131416),
    muted: Color(0xFF5D5F60),
    accent: Color(0xFF1B6C80),
    accentInk: Color(0xFF0F4552),
    accentTint: Color(0xFFE3F0F3),
    positive: Color(0xFF1E7B4F),
    negative: Color(0xFFC4242A),
    warning: Color(0xFF92400E),
    warningSoft: Color(0xFFFDF3DF),
    warningLine: Color(0xFFF0DCB4),
    warningInk: Color(0xFF6B3B07),
    onText: Color(0xFFFFFFFF),
  );

  static const dark = Tokens(
    ground: Color(0xFF121416),
    surface: Color(0xFF1B1E21),
    raised: Color(0xFF23272B),
    border: Color(0xFF30353A),
    text: Color(0xFFECEDEE),
    muted: Color(0xFFA4A9AD),
    accent: Color(0xFF4FB3C9),
    accentInk: Color(0xFF8FD3E2),
    accentTint: Color(0xFF173840),
    positive: Color(0xFF5CC98F),
    negative: Color(0xFFF2787B),
    warning: Color(0xFFF0B45A),
    warningSoft: Color(0xFF3A2E17),
    warningLine: Color(0xFF5C4720),
    warningInk: Color(0xFFF3D39C),
    onText: Color(0xFF121416),
  );

  /// Tokens del tema activo: `Tokens.of(context)`.
  static Tokens of(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? dark : light;
}

/// Radios de la web: tarjeta 8, control 6.
const double radiusCard = 8;
const double radiusControl = 6;

ThemeData buildTheme(Brightness brightness) {
  final t = brightness == Brightness.dark ? Tokens.dark : Tokens.light;
  final scheme = ColorScheme.fromSeed(seedColor: t.accent, brightness: brightness).copyWith(
    primary: t.accent,
    onPrimary: t.onText == Tokens.dark.onText ? t.onText : Colors.white,
    surface: t.surface,
    onSurface: t.text,
    error: t.negative,
    outline: t.border,
  );
  const font = 'IBM Plex Sans';
  final base = ThemeData(brightness: brightness, colorScheme: scheme, useMaterial3: true);
  OutlineInputBorder border(Color c) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(radiusControl),
        borderSide: BorderSide(color: c),
      );
  return base.copyWith(
    scaffoldBackgroundColor: t.ground,
    textTheme: base.textTheme.apply(bodyColor: t.text, displayColor: t.text, fontFamily: font, fontFamilyFallback: const ['Inter', 'Roboto']),
    appBarTheme: AppBarTheme(
      backgroundColor: t.ground,
      foregroundColor: t.text,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: TextStyle(color: t.text, fontSize: 18, fontWeight: FontWeight.w600),
    ),
    cardTheme: CardThemeData(
      color: t.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(radiusCard),
        side: BorderSide(color: t.border),
      ),
    ),
    dividerTheme: DividerThemeData(color: t.border, space: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: t.surface,
      border: border(t.border),
      enabledBorder: border(t.border),
      focusedBorder: border(t.accent),
      errorBorder: border(t.negative),
      focusedErrorBorder: border(t.negative),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: t.accent,
        foregroundColor: t.onText == Tokens.dark.onText ? t.onText : Colors.white,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radiusControl)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: t.text,
        minimumSize: const Size.fromHeight(48),
        side: BorderSide(color: t.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(radiusControl)),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: t.surface,
      indicatorColor: t.accentTint,
      iconTheme: WidgetStateProperty.resolveWith((s) =>
          IconThemeData(color: s.contains(WidgetState.selected) ? t.accentInk : t.muted)),
      labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: s.contains(WidgetState.selected) ? t.accentInk : t.muted,
          )),
    ),
  );
}
