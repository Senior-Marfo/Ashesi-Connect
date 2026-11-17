import 'package:local_auth/local_auth.dart';

/// The phone's own unlock check: Face ID, Touch ID, fingerprint, or the device passcode as a fallback.
abstract interface class DeviceUnlock {
  Future<bool> isAvailable();

  /// True only when the person passed the check; cancelling or failing returns false.
  Future<bool> authenticate(String reason);
}

class LocalAuthUnlock implements DeviceUnlock {
  LocalAuthUnlock([LocalAuthentication? auth]) : _auth = auth ?? LocalAuthentication();

  final LocalAuthentication _auth;

  @override
  Future<bool> isAvailable() async {
    try {
      return await _auth.isDeviceSupported();
    } on LocalAuthException {
      return false;
    }
  }

  @override
  Future<bool> authenticate(String reason) async {
    try {
      return await _auth.authenticate(localizedReason: reason, persistAcrossBackgrounding: true);
    } on LocalAuthException {
      return false;
    }
  }
}
