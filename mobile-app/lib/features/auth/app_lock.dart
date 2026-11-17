import 'dart:async';

import 'package:ashesi_graduation_tracker/core/device_unlock.dart';
import 'package:ashesi_graduation_tracker/core/providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final deviceUnlockProvider = Provider<DeviceUnlock>((ref) => LocalAuthUnlock());

/// How long the app may be in the background before it asks again.
const relockAfter = Duration(minutes: 1);

class AppLockState {
  const AppLockState({required this.enabled, required this.locked});

  final bool enabled;
  final bool locked;
}

final appLockProvider = AsyncNotifierProvider<AppLockController, AppLockState>(
  AppLockController.new,
);

/// Optional biometric unlock. Off by default; stored with the offline cache, so signing out clears it.
class AppLockController extends AsyncNotifier<AppLockState> {
  static const _key = 'biometric-unlock';
  DateTime? _hiddenAt;

  @override
  Future<AppLockState> build() async {
    final enabled = await ref.read(cacheProvider).read(_key) == 'on';
    // A fresh launch with the lock on starts locked.
    return AppLockState(enabled: enabled, locked: enabled);
  }

  bool get _enabled => state.value?.enabled ?? false;

  /// Turning the lock on requires passing the check once, so nobody locks themselves out by accident.
  Future<bool> setEnabled({required bool enabled}) async {
    if (enabled &&
        !await ref
            .read(deviceUnlockProvider)
            .authenticate('Turn on unlock for Graduation Tracker')) {
      return false;
    }
    await ref.read(cacheProvider).write(_key, enabled ? 'on' : 'off');
    state = AsyncData(AppLockState(enabled: enabled, locked: false));
    return true;
  }

  Future<bool> unlock() async {
    final passed = await ref.read(deviceUnlockProvider).authenticate('Unlock Graduation Tracker');
    if (passed) state = const AsyncData(AppLockState(enabled: true, locked: false));
    return passed;
  }

  /// When the app went into the background.
  // ignore: avoid_setters_without_getters
  set hiddenAt(DateTime at) => _hiddenAt = at;

  /// Locks again when the app comes back after [relockAfter] or longer.
  void appShown(DateTime at) {
    final hiddenAt = _hiddenAt;
    _hiddenAt = null;
    if (_enabled && hiddenAt != null && at.difference(hiddenAt) >= relockAfter) {
      state = const AsyncData(AppLockState(enabled: true, locked: true));
    }
  }
}
