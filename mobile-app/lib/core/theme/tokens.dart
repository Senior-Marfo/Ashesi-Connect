import 'package:flutter/material.dart';

/// Design tokens shared with the web client (web-app/frontend/app/globals.css).
@immutable
class AppColors extends ThemeExtension<AppColors> {
  const AppColors({
    required this.maroon,
    required this.maroonTint,
    required this.ink,
    required this.inkSoft,
    required this.line,
    required this.surface,
    required this.raised,
    required this.error,
    required this.errorBg,
    required this.progress,
    required this.progressBg,
    required this.ok,
    required this.okBg,
  });

  static const light = AppColors(
    maroon: Color(0xFF8B1C3B),
    maroonTint: Color(0xFFF6E9ED),
    ink: Color(0xFF221A1C),
    inkSoft: Color(0xFF5D5154),
    line: Color(0xFFE4DCD8),
    surface: Color(0xFFFBF9F7),
    raised: Color(0xFFFFFFFF),
    error: Color(0xFFB3261E),
    errorBg: Color(0xFFFBECEB),
    progress: Color(0xFF8A5D00),
    progressBg: Color(0xFFFBF1DA),
    ok: Color(0xFF17784A),
    okBg: Color(0xFFE4F4EB),
  );

  static const dark = AppColors(
    maroon: Color(0xFFE07A96),
    maroonTint: Color(0xFF3A1F27),
    ink: Color(0xFFF2ECEA),
    inkSoft: Color(0xFFB8ACA9),
    line: Color(0xFF3A3233),
    surface: Color(0xFF171314),
    raised: Color(0xFF201B1C),
    error: Color(0xFFFF8A80),
    errorBg: Color(0xFF3A1C1A),
    progress: Color(0xFFF0C35A),
    progressBg: Color(0xFF382C12),
    ok: Color(0xFF6FD3A0),
    okBg: Color(0xFF16301F),
  );

  final Color maroon;
  final Color maroonTint;
  final Color ink;
  final Color inkSoft;
  final Color line;
  final Color surface;
  final Color raised;
  final Color error;
  final Color errorBg;
  final Color progress;
  final Color progressBg;
  final Color ok;
  final Color okBg;

  @override
  AppColors copyWith({Color? maroon, Color? ink}) => AppColors(
    maroon: maroon ?? this.maroon,
    maroonTint: maroonTint,
    ink: ink ?? this.ink,
    inkSoft: inkSoft,
    line: line,
    surface: surface,
    raised: raised,
    error: error,
    errorBg: errorBg,
    progress: progress,
    progressBg: progressBg,
    ok: ok,
    okBg: okBg,
  );

  @override
  AppColors lerp(AppColors? other, double t) {
    if (other == null) return this;
    Color mix(Color a, Color b) => Color.lerp(a, b, t)!;
    return AppColors(
      maroon: mix(maroon, other.maroon),
      maroonTint: mix(maroonTint, other.maroonTint),
      ink: mix(ink, other.ink),
      inkSoft: mix(inkSoft, other.inkSoft),
      line: mix(line, other.line),
      surface: mix(surface, other.surface),
      raised: mix(raised, other.raised),
      error: mix(error, other.error),
      errorBg: mix(errorBg, other.errorBg),
      progress: mix(progress, other.progress),
      progressBg: mix(progressBg, other.progressBg),
      ok: mix(ok, other.ok),
      okBg: mix(okBg, other.okBg),
    );
  }
}

/// Spacing scale (matches --space-1 … --space-7).
abstract final class Space {
  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0;
  static const s5 = 24.0;
  static const s6 = 40.0;
  static const s7 = 64.0;
}

abstract final class Radii {
  static const small = 6.0;
  static const card = 16.0;
}

extension AppThemeContext on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>()!;
  TextTheme get text => Theme.of(this).textTheme;
}
