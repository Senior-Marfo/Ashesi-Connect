import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

typedef Handler = FakeResponse Function(RequestOptions request);

class FakeResponse {
  const FakeResponse(this.status, [this.body, this.cookies = const []]);

  final int status;
  final Object? body;
  final List<String> cookies;
}

/// Answers API requests in memory, keyed by "METHOD /path", and records every request.
class FakeServer implements HttpClientAdapter {
  final routes = <String, Handler>{};
  final requests = <RequestOptions>[];
  bool offline = false;

  void on(String route, Handler handler) => routes[route] = handler;

  int count(String route) =>
      requests.where((request) => '${request.method} ${request.uri.path}' == route).length;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (offline) {
      throw DioException.connectionError(requestOptions: options, reason: 'offline');
    }
    final key = '${options.method} ${options.uri.path}';
    final handler = routes[key];
    final response = handler == null
        ? const FakeResponse(404, {'error': 'NOT_FOUND'})
        : handler(options);
    return ResponseBody.fromString(
      response.body == null ? '' : jsonEncode(response.body),
      response.status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
        if (response.cookies.isNotEmpty) 'set-cookie': response.cookies,
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

Map<String, Object?> tokens({
  String role = 'STUDENT',
  bool passwordChangeRequired = false,
  String token = 'access-1',
}) => {
  'accessToken': token,
  'expiresIn': 900,
  'role': role,
  'passwordChangeRequired': passwordChangeRequired,
};

String refreshCookie(String value) =>
    'agt_refresh=$value; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict';
