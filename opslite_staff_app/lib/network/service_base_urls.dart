import 'dart:core';

/// Recebe "http://10.0.2.2:8081" e devolve "http://10.0.2.2:8000" etc.
String withPort(String baseUrl, int port) {
  final uri = Uri.parse(baseUrl);
  return uri.replace(port: port).toString();
}
