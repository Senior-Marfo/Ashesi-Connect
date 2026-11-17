import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// A serif display face for headings and the platform UI face for everything else.
const _display = 'serif';
const _displayFallback = ['Iowan Old Style', 'Palatino', 'Georgia'];

ThemeData buildTheme(Brightness brightness) {
  final colors = brightness == Brightness.light ? AppColors.light : AppColors.dark;
  final scheme = ColorScheme.fromSeed(seedColor: AppColors.light.maroon, brightness: brightness)
      .copyWith(
        primary: colors.maroon,
        onPrimary: brightness == Brightness.light ? Colors.white : const Color(0xFF1A0D11),
        surface: colors.surface,
        onSurface: colors.ink,
        error: colors.error,
        outline: colors.line,
      );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: brightness);
  TextStyle display(double size, [FontWeight weight = FontWeight.w400]) => TextStyle(
    fontFamily: _display,
    fontFamilyFallback: _displayFallback,
    fontSize: size,
    fontWeight: weight,
    height: 1.15,
    color: colors.ink,
  );
  final text = base.textTheme
      .apply(bodyColor: colors.ink, displayColor: colors.ink)
      .copyWith(
        displaySmall: display(36),
        headlineMedium: display(28),
        headlineSmall: display(24),
        titleLarge: display(22),
        labelSmall: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.2,
          color: colors.inkSoft,
        ),
      );
  return base.copyWith(
    scaffoldBackgroundColor: colors.surface,
    textTheme: text,
    extensions: [colors],
    appBarTheme: AppBarTheme(
      backgroundColor: colors.surface,
      foregroundColor: colors.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    dividerTheme: DividerThemeData(color: colors.line, space: 1, thickness: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: colors.raised,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Radii.small),
        borderSide: BorderSide(color: colors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Radii.small),
        borderSide: BorderSide(color: colors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(Radii.small),
        borderSide: BorderSide(color: colors.maroon, width: 2),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.small)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 44),
        foregroundColor: colors.ink,
        side: BorderSide(color: colors.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.small)),
      ),
    ),
    // iOS keeps its default swipe-back transition.
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {TargetPlatform.android: PredictiveBackPageTransitionsBuilder()},
    ),
  );
}
