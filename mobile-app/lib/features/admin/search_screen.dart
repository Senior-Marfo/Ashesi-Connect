import 'dart:async';

import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/features/admin/admin_data.dart';
import 'package:ashesi_graduation_tracker/features/auth/session.dart';
import 'package:ashesi_graduation_tracker/widgets/page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Streamlined admin experience: find a student and open their record.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounce;
  String _query = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String text) {
    _debounce?.cancel();
    _debounce = Timer(
      const Duration(milliseconds: 300),
      () => setState(() => _query = text.trim()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final results = ref.watch(studentSearchProvider(_query));
    return LargeTitlePage(
      eyebrow: 'Registry workspace',
      title: 'Students',
      bottomPadding: Space.s6,
      actions: [
        PopupMenuButton<String>(
          tooltip: 'Account',
          icon: const Icon(Icons.account_circle_outlined),
          onSelected: (choice) => choice == 'security'
              ? context.push('/security')
              : ref.read(sessionProvider.notifier).signOut(),
          itemBuilder: (_) => const [
            PopupMenuItem(value: 'security', child: Text('Unlock and password')),
            PopupMenuItem(value: 'signout', child: Text('Sign out')),
          ],
        ),
      ],
      slivers: [
        SliverToBoxAdapter(
          child: TextField(
            controller: _controller,
            autofocus: true,
            autocorrect: false,
            textInputAction: TextInputAction.search,
            decoration: const InputDecoration(
              labelText: 'Student ID or name',
              prefixIcon: Icon(Icons.search),
              helperText:
                  'Close matches appear when nothing matches exactly. Lookups are audit-logged.',
              helperMaxLines: 2,
            ),
            onChanged: _onChanged,
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: Space.s4)),
        if (_query.isEmpty)
          const SliverToBoxAdapter(child: EmptyState('Search for a student to open their record.'))
        else
          switch (results) {
            AsyncData(:final value) when value.isEmpty => SliverToBoxAdapter(
              child: EmptyState('No students match “$_query”, even allowing for a typo.'),
            ),
            AsyncData(:final value) => SliverList.list(
              children: [
                if (value.first.closeMatch)
                  const Padding(
                    padding: EdgeInsets.only(bottom: Space.s2),
                    child: Notice('Nothing matches exactly. Did you mean one of these?'),
                  ),
                for (final result in value)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      result.student.studentId,
                      style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      '${result.student.fullName} · ${result.student.programme} ${result.student.yearGroup}'
                      '${result.student.synthetic ? ' · Synthetic' : ''}'
                      '${result.closeMatch ? ' · Close match' : ''}',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push(
                      '/admin/student/${Uri.encodeComponent(result.student.studentId)}',
                    ),
                  ),
              ],
            ),
            AsyncError(:final error) => LoadError(
              error: error,
              what: 'Search results',
              onRetry: () => ref.invalidate(studentSearchProvider(_query)),
            ),
            _ => const LoadingSliver(),
          },
      ],
    );
  }
}
