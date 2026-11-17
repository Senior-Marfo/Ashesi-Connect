import 'package:ashesi_graduation_tracker/core/api/api_error.dart';
import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:flutter/material.dart';

/// A screen with a large title that collapses into the bar as content scrolls.
class LargeTitlePage extends StatelessWidget {
  const LargeTitlePage({
    required this.title,
    required this.slivers,
    super.key,
    this.eyebrow,
    this.actions,
    this.onRefresh,
    this.bottomPadding = 120,
  });

  final String title;
  final String? eyebrow;
  final List<Widget>? actions;
  final List<Widget> slivers;
  final Future<void> Function()? onRefresh;

  /// Room for the floating tab bar.
  final double bottomPadding;

  @override
  Widget build(BuildContext context) {
    final scroll = CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
      slivers: [
        SliverAppBar.large(
          actions: actions,
          title: Text(title, style: context.text.headlineMedium),
        ),
        if (eyebrow != null)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s4),
              child: Text(
                eyebrow!.toUpperCase(),
                style: context.text.labelSmall?.copyWith(color: context.colors.maroon),
              ),
            ),
          ),
        ...slivers.map(
          (sliver) => SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: Space.s4),
            sliver: sliver,
          ),
        ),
        SliverToBoxAdapter(child: SizedBox(height: bottomPadding)),
      ],
    );
    return Scaffold(
      body: onRefresh == null ? scroll : RefreshIndicator(onRefresh: onRefresh!, child: scroll),
    );
  }
}

class Notice extends StatelessWidget {
  const Notice(this.text, {super.key, this.error = false});

  final String text;
  final bool error;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Semantics(
      liveRegion: error,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(Space.s3),
        decoration: BoxDecoration(
          color: error ? colors.errorBg : colors.maroonTint.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(Radii.small),
          border: Border(left: BorderSide(color: error ? colors.error : colors.inkSoft, width: 3)),
        ),
        child: Text(text, style: TextStyle(color: error ? colors.error : colors.ink, fontSize: 14)),
      ),
    );
  }
}

/// Banner shown when data comes from the offline copy.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner(this.savedAt, {super.key});

  final DateTime savedAt;

  @override
  Widget build(BuildContext context) {
    final local = savedAt.toLocal();
    final when =
        '${local.day}/${local.month}/${local.year} at ${local.hour}:${local.minute.toString().padLeft(2, '0')}';
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.s4),
      child: Notice('Offline. Showing what was saved on $when. Pull down to try again.'),
    );
  }
}

/// A failed load with a retry, as a sliver.
class LoadError extends StatelessWidget {
  const LoadError({required this.error, required this.onRetry, required this.what, super.key});

  final Object error;
  final VoidCallback onRetry;
  final String what;

  @override
  Widget build(BuildContext context) => SliverToBoxAdapter(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Notice(
          error is ApiError
              ? (error as ApiError).describe('$what could not be loaded.')
              : '$what could not be loaded.',
          error: true,
        ),
        const SizedBox(height: Space.s3),
        OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
      ],
    ),
  );
}

class LoadingSliver extends StatelessWidget {
  const LoadingSliver({super.key});

  @override
  Widget build(BuildContext context) => const SliverToBoxAdapter(
    child: Padding(
      padding: EdgeInsets.symmetric(vertical: Space.s6),
      child: Center(child: CircularProgressIndicator.adaptive()),
    ),
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(vertical: Space.s6, horizontal: Space.s4),
    decoration: BoxDecoration(
      border: Border.all(color: context.colors.line),
      borderRadius: BorderRadius.circular(Radii.small),
    ),
    child: Text(
      text,
      textAlign: TextAlign.center,
      style: TextStyle(color: context.colors.inkSoft),
    ),
  );
}

/// An uppercase field label over a value, like the web `facts` list.
class Fact extends StatelessWidget {
  const Fact(this.label, this.value, {super.key, this.mono = false});

  final String label;
  final String value;
  final bool mono;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label.toUpperCase(), style: context.text.labelSmall),
      const SizedBox(height: 2),
      Text(
        value,
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          fontFamily: mono ? 'monospace' : null,
        ),
      ),
    ],
  );
}
