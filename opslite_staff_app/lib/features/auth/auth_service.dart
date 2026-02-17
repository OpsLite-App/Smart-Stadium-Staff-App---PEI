import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../network/http_client.dart';

class LoginResult {
  final String token;
  final int userId;
  final String role;

  const LoginResult({
    required this.token,
    required this.userId,
    required this.role,
  });

  factory LoginResult.fromJson(Map<String, dynamic> json) {
    return LoginResult(
      token: (json['token'] as String),
      userId: (json['user_id'] as num).toInt(),
      role: (json['role'] as String),
    );
  }
}

class AuthService {
  AuthService(this._dio);
  final Dio _dio;

  /// POST /auth/login
  /// body: { "username": "...", "password": "..." }
  /// resp: { "token": "...", "user_id": 1, "role": "Security" }
  Future<LoginResult> login({
    required String username,
    required String password,
  }) async {
    final resp = await _dio.post(
      '/auth/login',
      data: {
        'username': username,
        'password': password,
      },
    );

    final data = resp.data;
    if (data is! Map<String, dynamic>) {
      throw StateError('Unexpected login response: ${resp.data}');
    }

    return LoginResult.fromJson(data);
  }

  /// POST /auth/validate (útil para debug)
  Future<Map<String, dynamic>> validateToken(String token) async {
    final resp = await _dio.post(
      '/auth/validate',
      options: Options(headers: {'Authorization': 'Bearer $token'}),
    );

    final data = resp.data;
    if (data is! Map<String, dynamic>) {
      throw StateError('Unexpected validate response: ${resp.data}');
    }
    return data;
  }
}

final authServiceProvider = Provider<AuthService>((ref) {
  final dio = ref.read(dioProvider);
  return AuthService(dio);
});
