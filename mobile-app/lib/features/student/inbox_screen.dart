import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/features/student/student_data.dart';
import 'package:ashesi_graduation_tracker/models/message.dart';
import 'package:ashesi_graduation_tracker/widgets/page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

class InboxScreen extends ConsumerWidget {
  const InboxScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inbox = ref.watch(inboxProvider);
    final unread = ref.watch(unreadCountProvider);
    return LargeTitlePage(
      eyebrow: 'Messages from the Registry',
      title: 'Inbox',
      onRefresh: () => ref.read(inboxProvider.notifier).refresh(),
      actions: [
        if (unread > 0)
          TextButton(
            onPressed: () => ref.read(inboxProvider.notifier).markAllRead(),
            child: const Text('Mark all read'),
          ),
      ],
      slivers: [
        switch (inbox) {
          AsyncData(:final value) when value.isEmpty => const SliverToBoxAdapter(
            child: EmptyState('No messages yet. Notices from the Registry will appear here.'),
          ),
          AsyncData(:final value) => SliverList.separated(
            itemCount: value.length,
            separatorBuilder: (_, _) => const Divider(),
            itemBuilder: (context, index) => _MessageTile(
              item: value[index],
              onOpen: () => ref.read(inboxProvider.notifier).markRead(value[index].id),
            ),
          ),
          AsyncError(:final error) => LoadError(
            error: error,
            what: 'Your messages',
            onRetry: () => ref.invalidate(inboxProvider),
          ),
          _ => const LoadingSliver(),
        },
      ],
    );
  }
}

class _MessageTile extends StatelessWidget {
  const _MessageTile({required this.item, required this.onOpen});

  final InboxItem item;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        onExpansionChanged: (open) {
          if (open) onOpen();
        },
        leading: Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: item.unread ? colors.maroon : Colors.transparent,
          ),
        ),
        title: Text(
          item.title,
          semanticsLabel: '${item.unread ? 'Unread: ' : ''}${item.title}',
          style: TextStyle(fontWeight: item.unread ? FontWeight.w700 : FontWeight.w500),
        ),
        subtitle: Text(
          '${DateFormat.yMMMd().add_jm().format(item.sentAt.toLocal())}${item.highPriority ? ' · High priority' : ''}',
          style: TextStyle(color: item.highPriority ? colors.error : colors.inkSoft, fontSize: 13),
        ),
        expandedCrossAxisAlignment: CrossAxisAlignment.start,
        childrenPadding: const EdgeInsets.only(left: 56, bottom: Space.s4),
        children: [SelectableText(item.body)],
      ),
    );
  }
}
