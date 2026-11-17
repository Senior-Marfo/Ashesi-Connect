import 'package:ashesi_graduation_tracker/core/api/api_error.dart';
import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/features/auth/session.dart';
import 'package:ashesi_graduation_tracker/widgets/page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Used both for the forced change after a temporary password and a voluntary change.
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _form = GlobalKey<FormState>();
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit({required bool required}) async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(sessionProvider.notifier).changePassword(_current.text, _next.text);
      if (!mounted) return;
      if (!required) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Password changed.')));
        context.pop();
      }
    } on ApiError catch (error) {
      setState(
        () => _error = error.code == 'INVALID_CREDENTIALS'
            ? 'The current password is not right.'
            : error.describe('The password could not be changed.'),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final required = ref.watch(sessionProvider).value?.info.passwordChangeRequired ?? false;
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !required,
        actions: [
          if (required)
            TextButton(
              onPressed: () => ref.read(sessionProvider.notifier).signOut(),
              child: const Text('Sign out'),
            ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(Space.s5),
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  required ? 'Set a new password' : 'Change password',
                  style: context.text.displaySmall,
                ),
                const SizedBox(height: Space.s2),
                Text(
                  required
                      ? 'Your account has a temporary password. Choose a new one to continue.'
                      : 'Changing your password signs you out on every other device.',
                  style: TextStyle(color: context.colors.inkSoft),
                ),
                const SizedBox(height: Space.s5),
                TextFormField(
                  controller: _current,
                  obscureText: true,
                  autofillHints: const [AutofillHints.password],
                  decoration: InputDecoration(
                    labelText: required ? 'Temporary password' : 'Current password',
                  ),
                  validator: (value) => (value ?? '').isEmpty ? 'Required.' : null,
                ),
                const SizedBox(height: Space.s4),
                TextFormField(
                  controller: _next,
                  obscureText: true,
                  autofillHints: const [AutofillHints.newPassword],
                  decoration: const InputDecoration(
                    labelText: 'New password',
                    helperText: 'At least 12 characters, with three of: lowercase, uppercase, digits, symbols.',
                    helperMaxLines: 2,
                  ),
                  validator: (value) =>
                      (value ?? '').length < 12 ? 'Use at least 12 characters.' : null,
                ),
                const SizedBox(height: Space.s4),
                TextFormField(
                  controller: _confirm,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Confirm new password'),
                  validator: (value) =>
                      value != _next.text ? 'The new passwords do not match.' : null,
                ),
                if (_error != null) ...[
                  const SizedBox(height: Space.s4),
                  Notice(_error!, error: true),
                ],
                const SizedBox(height: Space.s5),
                FilledButton(
                  onPressed: _busy ? null : () => _submit(required: required),
                  child: Text(_busy ? 'Saving…' : 'Save new password'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
