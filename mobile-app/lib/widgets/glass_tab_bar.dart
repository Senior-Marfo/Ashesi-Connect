import 'dart:ui';

import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:flutter/material.dart';

class GlassTab {
  const GlassTab({
    required this.icon,
    required this.selectedIcon,
    required this.label,
    this.badge = 0,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;
  final int badge;
}

/// A floating, translucent tab bar over the content, with layered blur and soft depth.
class GlassTabBar extends StatelessWidget {
  const GlassTabBar({required this.tabs, required this.index, required this.onSelect, super.key});

  final List<GlassTab> tabs;
  final int index;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(Space.s4, 0, Space.s4, Space.s3),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: dark ? 0.45 : 0.12),
              blurRadius: 30,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
            child: DecoratedBox(
              decoration: BoxDecoration(
                // Opaque enough to keep labels at full contrast over any content.
                color: colors.raised.withValues(alpha: dark ? 0.78 : 0.84),
                borderRadius: BorderRadius.circular(28),
                border: Border.all(color: colors.line.withValues(alpha: 0.8)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(6),
                child: Row(
                  children: [
                    for (var i = 0; i < tabs.length; i++)
                      Expanded(
                        child: _TabButton(
                          tab: tabs[i],
                          selected: i == index,
                          onTap: () => onSelect(i),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({required this.tab, required this.selected, required this.onTap});

  final GlassTab tab;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final reduceMotion = MediaQuery.of(context).disableAnimations;
    final color = selected ? colors.maroon : colors.inkSoft;
    final badge = tab.badge > 0 ? ', ${tab.badge} unread' : '';
    return Semantics(
      button: true,
      selected: selected,
      label: '${tab.label}$badge',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: onTap,
        child: AnimatedContainer(
          duration: reduceMotion ? Duration.zero : const Duration(milliseconds: 260),
          curve: Curves.easeOutBack,
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: selected ? colors.maroonTint : Colors.transparent,
            borderRadius: BorderRadius.circular(22),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Badge(
                isLabelVisible: tab.badge > 0,
                label: Text('${tab.badge}'),
                backgroundColor: colors.maroon,
                child: Icon(selected ? tab.selectedIcon : tab.icon, color: color, size: 22),
              ),
              const SizedBox(height: 3),
              Text(
                tab.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
