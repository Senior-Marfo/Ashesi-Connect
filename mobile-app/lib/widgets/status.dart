import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/models/eligibility.dart';
import 'package:ashesi_graduation_tracker/models/labels.dart';
import 'package:flutter/material.dart';

({Color fg, Color bg, IconData icon}) standingStyle(BuildContext context, StandingLevel level) {
  final colors = context.colors;
  return switch (level) {
    StandingLevel.green => (fg: colors.ok, bg: colors.okBg, icon: Icons.check_circle_outline),
    StandingLevel.yellow => (fg: colors.progress, bg: colors.progressBg, icon: Icons.error_outline),
    StandingLevel.red => (fg: colors.error, bg: colors.errorBg, icon: Icons.cancel_outlined),
  };
}

/// Standing as icon, text and colour together: colour is never the only signal.
class StandingBadge extends StatelessWidget {
  const StandingBadge(this.level, {super.key});

  final StandingLevel level;

  @override
  Widget build(BuildContext context) {
    final style = standingStyle(context, level);
    return _Pill(
      color: style.fg,
      background: style.bg,
      icon: style.icon,
      label: standingLabel(level),
    );
  }
}

/// The state of one requirement or course attempt.
class StateChip extends StatelessWidget {
  const StateChip({required this.label, required this.tone, super.key});

  factory StateChip.forState(RequirementState state) => StateChip(
    label: stateLabel(state),
    tone: switch (state) {
      RequirementState.completed => ChipTone.ok,
      RequirementState.inProgress => ChipTone.progress,
      RequirementState.failed || RequirementState.incomplete => ChipTone.error,
      RequirementState.notStarted => ChipTone.neutral,
    },
  );

  final String label;
  final ChipTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final (fg, bg, icon) = switch (tone) {
      ChipTone.ok => (colors.ok, colors.okBg, Icons.check),
      ChipTone.progress => (colors.progress, colors.progressBg, Icons.schedule),
      ChipTone.error => (colors.error, colors.errorBg, Icons.priority_high),
      ChipTone.neutral => (
        colors.inkSoft,
        colors.line.withValues(alpha: 0.5),
        Icons.radio_button_unchecked,
      ),
    };
    return _Pill(color: fg, background: bg, icon: icon, label: label, small: true);
  }
}

enum ChipTone { ok, progress, error, neutral }

class _Pill extends StatelessWidget {
  const _Pill({
    required this.color,
    required this.background,
    required this.icon,
    required this.label,
    this.small = false,
  });

  final Color color;
  final Color background;
  final IconData icon;
  final String label;
  final bool small;

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
    child: Padding(
      padding: EdgeInsets.symmetric(horizontal: small ? 8 : 10, vertical: small ? 3 : 5),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: small ? 13 : 16, color: color),
          const SizedBox(width: 5),
          Text(
            label,
            style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: small ? 12 : 14),
          ),
        ],
      ),
    ),
  );
}
