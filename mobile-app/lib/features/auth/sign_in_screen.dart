import 'package:ashesi_graduation_tracker/core/api/api_error.dart';
import 'package:ashesi_graduation_tracker/core/theme/tokens.dart';
import 'package:ashesi_graduation_tracker/features/auth/session.dart';
import 'package:ashesi_graduation_tracker/widgets/page.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// One ID field for everyone: the server decides whether it is a student or staff account.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _form = GlobalKey<FormState>();
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(sessionProvider.notifier).signIn(_identifier.text, _password.text);
    } on ApiError catch (error) {
      setState(() => _error = _messageFor(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _messageFor(ApiError error) => switch (error.code) {
    'INVALID_CREDENTIALS' => 'That ID and password do not match an account.',
    'TOO_MANY_ATTEMPTS' => 'Too many attempts. Wait a few minutes and try again.',
    _ => error.describe('Sign-in failed. Try again.'),
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(Space.s5),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: AutofillGroup(
                child: Form(
                  key: _form,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: 'Ashesi ',
                              style: TextStyle(color: colors.maroon),
                            ),
                            const TextSpan(text: 'Graduation Tracker'),
                          ],
                        ),
                        style: context.text.titleLarge,
                      ),
                      const SizedBox(height: Space.s6),
                      Text('Sign in', style: context.text.displaySmall),
                      const SizedBox(height: Space.s2),
                      Text(
                        'Use your student or staff ID.',
                        style: TextStyle(color: colors.inkSoft),
                      ),
                      const SizedBox(height: Space.s5),
                      TextFormField(
                        controller: _identifier,
                        decoration: const InputDecoration(labelText: 'Student or staff ID'),
                        autofillHints: const [AutofillHints.username],
                        textInputAction: TextInputAction.next,
                        autocorrect: false,
                        validator: (value) =>
                            (value ?? '').trim().isEmpty ? 'Enter your ID.' : null,
                      ),
                      const SizedBox(height: Space.s4),
                      TextFormField(
                        controller: _password,
                        obscureText: _obscure,
                        decoration: InputDecoration(
                          labelText: 'Password',
                          suffixIcon: IconButton(
                            tooltip: _obscure ? 'Show password' : 'Hide password',
                            icon: Icon(
                              _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                            ),
                            onPressed: () => setState(() => _obscure = !_obscure),
                          ),
                        ),
                        autofillHints: const [AutofillHints.password],
                        textInputAction: TextInputAction.done,
                        onFieldSubmitted: (_) => _submit(),
                        validator: (value) => (value ?? '').isEmpty ? 'Enter your password.' : null,
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: Space.s4),
                        Notice(_error!, error: true),
                      ],
                      const SizedBox(height: Space.s5),
                      FilledButton(
                        onPressed: _busy ? null : _submit,
                        child: _busy
                            ? const SizedBox.square(
                                dimension: 20,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Sign in'),
                      ),
                      const SizedBox(height: Space.s6),
                      Text(
                        'Independent prototype, not an official Ashesi University service. '
                        'Forgotten your password? Ask the Registry for a temporary one.',
                        style: TextStyle(color: colors.inkSoft, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
