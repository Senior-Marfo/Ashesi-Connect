import 'dart:async';

import 'package:ashesi_graduation_tracker/features/student/student_data.dart';
import 'package:ashesi_graduation_tracker/widgets/glass_tab_bar.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Student tabs over a floating glass tab bar; each tab keeps its own scroll position.
class StudentShell extends ConsumerWidget {
  const StudentShell({required this.shell, super.key});

  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadCountProvider);
    return Scaffold(
      extendBody: true,
      body: shell,
      bottomNavigationBar: GlassTabBar(
        index: shell.currentIndex,
        onSelect: (index) {
          unawaited(HapticFeedback.selectionClick());
          shell.goBranch(index, initialLocation: index == shell.currentIndex);
        },
        tabs: [
          const GlassTab(
            icon: Icons.donut_large_outlined,
            selectedIcon: Icons.donut_large,
            label: 'Status',
          ),
          const GlassTab(
            icon: Icons.checklist_outlined,
            selectedIcon: Icons.checklist,
            label: 'Requirements',
          ),
          const GlassTab(
            icon: Icons.menu_book_outlined,
            selectedIcon: Icons.menu_book,
            label: 'Courses',
          ),
          GlassTab(
            icon: Icons.inbox_outlined,
            selectedIcon: Icons.inbox,
            label: 'Inbox',
            badge: unread,
          ),
          const GlassTab(icon: Icons.person_outline, selectedIcon: Icons.person, label: 'Profile'),
        ],
      ),
    );
  }
}
