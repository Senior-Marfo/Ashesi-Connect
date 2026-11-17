import 'dart:async';

import 'package:ashesi_graduation_tracker/core/api/api_error.dart';
import 'package:ashesi_graduation_tracker/core/api/token_store.dart';
import 'package:dio/dio.dart';

/// The signed-in account as the server reports it; the role is never chosen by the app.
class SessionInfo {
  const SessionInfo({required this.role, required this.passwordChangeRequired});

  factory SessionInfo.fromJson(Map<String, dynamic> json) => SessionInfo(
    role: json['role'] == 'ADMIN' ? Role.admin : Role.student,
    passwordChangeRequired: json['passwordChangeRequired'] == true,
  );

  final Role role;
  final bool passwordChangeRequired;
}

enum Role { student, admin }

/// HTTP access to `/api/v1` with short-lived access tokens and a rotating refresh cookie.
///
/// A request that fails with 401 refreshes once and retries; concurrent
/// failures share the same refresh so the rotating token is used only once.
class ApiClient {
  ApiClient({required String baseUrl, required TokenStore tokens, HttpClientAdapter? adapter})
    // Named parameters cannot be private, so `this._tokens` is not an option here.
    // ignore: prefer_initializing_formals
    : _tokens = tokens,
      _dio = Dio(
        BaseOptions(
          baseUrl: '$baseUrl/api/v1',
          connectTimeout: const Duration(seconds: 20),
          // Render's free tier can take close to a minute to wake.
          receiveTimeout: const Duration(seconds: 60),
          headers: {'accept': 'application/json'},
          validateStatus: (_) => true,
        ),
      ) {
    if (adapter != null) _dio.httpClientAdapter = adapter;
  }

  static const _refreshCookie = 'agt_refresh';
  // The refresh and logout routes require this header as CSRF protection.
  static const _csrf = {'x-requested-with': 'ashesi-graduation-tracker-mobile'};

  final Dio _dio;
  final TokenStore _tokens;
  String? _accessToken;
  Future<SessionInfo?>? _refreshing;

  Future<SessionInfo> login(String identifier, String password) async {
    final response = await _send(
      'POST',
      '/auth/login',
      data: {'identifier': identifier, 'password': password},
    );
    return await _acceptSession(response);
  }

  /// Restores a session from the stored refresh cookie; null when there is none or it was rejected.
  Future<SessionInfo?> restore() => _refresh();

  Future<SessionInfo> changePassword(String currentPassword, String newPassword) async {
    final response = await _authorised(
      'POST',
      '/auth/password',
      data: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
    return await _acceptSession(response);
  }

  Future<void> logout() async {
    final cookie = await _tokens.readRefreshCookie();
    try {
      await _send('POST', '/auth/logout', headers: {..._csrf, 'cookie': ?cookie});
    } on ApiError {
      // Signing out locally must work even when the server cannot be reached.
    } finally {
      _accessToken = null;
      await _tokens.clear();
    }
  }

  Future<Map<String, dynamic>> getJson(String path, {Map<String, dynamic>? query}) async =>
      _json(await _authorised('GET', path, query: query));

  Future<Map<String, dynamic>> postJson(String path, [Object? body]) async =>
      _json(await _authorised('POST', path, data: body));

  Future<void> post(String path, [Object? body]) async {
    await _authorised('POST', path, data: body);
  }

  Future<Response<dynamic>> _authorised(
    String method,
    String path, {
    Object? data,
    Map<String, dynamic>? query,
  }) async {
    if (_accessToken == null) await _refresh();
    var response = await _send(method, path, data: data, query: query, headers: _bearer());
    if (response.statusCode == 401) {
      final session = await _refresh();
      if (session == null) {
        throw const ApiError(401, 'SESSION_EXPIRED', 'Your session has ended. Sign in again.');
      }
      response = await _send(method, path, data: data, query: query, headers: _bearer());
    }
    _throwIfFailed(response);
    return response;
  }

  Map<String, String> _bearer() => {
    if (_accessToken != null) 'authorization': 'Bearer $_accessToken',
  };

  Future<SessionInfo?> _refresh() =>
      _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);

  Future<SessionInfo?> _doRefresh() async {
    final cookie = await _tokens.readRefreshCookie();
    if (cookie == null) return null;
    final response = await _send('POST', '/auth/refresh', headers: {..._csrf, 'cookie': cookie});
    if (response.statusCode != 200) {
      if (response.statusCode == 401) await _tokens.clear();
      _accessToken = null;
      return null;
    }
    return await _acceptSession(response);
  }

  Future<SessionInfo> _acceptSession(Response<dynamic> response) async {
    _throwIfFailed(response);
    final body = _json(response);
    _accessToken = body['accessToken'] as String?;
    final cookie = _refreshCookieFrom(response.headers);
    if (cookie != null) await _tokens.writeRefreshCookie(cookie);
    return SessionInfo.fromJson(body);
  }

  String? _refreshCookieFrom(Headers headers) {
    for (final header in headers.map['set-cookie'] ?? const <String>[]) {
      final pair = header.split(';').first.trim();
      if (pair.startsWith('$_refreshCookie=') && pair.length > _refreshCookie.length + 1) {
        return pair;
      }
    }
    return null;
  }

  Future<Response<dynamic>> _send(
    String method,
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    Map<String, String>? headers,
  }) async {
    try {
      return await _dio.request<dynamic>(
        path,
        data: data,
        queryParameters: query,
        options: Options(
          method: method,
          headers: headers,
          contentType: data == null ? null : Headers.jsonContentType,
        ),
      );
    } on DioException catch (error) {
      throw ApiError(0, 'NETWORK', error.message);
    }
  }

  void _throwIfFailed(Response<dynamic> response) {
    final status = response.statusCode ?? 0;
    if (status >= 200 && status < 300) return;
    final body = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : const <String, dynamic>{};
    throw ApiError(
      status,
      body['error'] as String? ?? 'REQUEST_FAILED',
      body['message'] as String?,
    );
  }

  Map<String, dynamic> _json(Response<dynamic> response) => response.data is Map<String, dynamic>
      ? response.data as Map<String, dynamic>
      : <String, dynamic>{};
}
