import 'dart:math' as math;

import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// Credits completed (solid) and in progress (soft) against the programme total.
/// Animates from empty on first show unless the device asks for reduced motion.
class ProgressRing extends StatelessWidget {
  const ProgressRing({
    required this.completed,
    required this.inProgress,
    super.key,
    this.size = 148,
  });

  /// Fractions of the total, from 0 to 1.
  final double completed;
  final double inProgress;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    final percent = (completed * 100).clamp(0, 100).round();
    return Semantics(
      container: true,
      label: '$percent percent of credits completed',
      excludeSemantics: true,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: reduceMotion ? 1 : 0, end: 1),
        duration: reduceMotion ? Duration.zero : const Duration(milliseconds: 1100),
        curve: Curves.easeOutCubic,
        builder: (context, t, _) => SizedBox.square(
          dimension: size,
          child: CustomPaint(
            painter: _RingPainter(
              completed: completed.clamp(0, 1) * t,
              inProgress: inProgress.clamp(0, 1) * t,
              track: colors.line,
              done: colors.maroon,
              pending: colors.maroon.withValues(alpha: 0.35),
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('${(percent * t).round()}%', style: context.text.headlineMedium),
                  Text('COMPLETE', style: context.text.labelSmall),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({
    required this.completed,
    required this.inProgress,
    required this.track,
    required this.done,
    required this.pending,
  });

  final double completed;
  final double inProgress;
  final Color track;
  final Color done;
  final Color pending;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 12.0;
    final rect = Offset.zero & size;
    final arc = rect.deflate(stroke / 2);
    Paint paint(Color color) => Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    const start = -math.pi / 2;
    canvas.drawArc(arc, 0, math.pi * 2, false, paint(track));
    final pendingSweep = math.pi * 2 * math.min(1, completed + inProgress);
    if (inProgress > 0) canvas.drawArc(arc, start, pendingSweep, false, paint(pending));
    if (completed > 0) canvas.drawArc(arc, start, math.pi * 2 * completed, false, paint(done));
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.completed != completed || old.inProgress != inProgress;
}
