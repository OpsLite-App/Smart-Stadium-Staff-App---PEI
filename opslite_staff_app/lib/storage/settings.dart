class Settings {
  const Settings({
    required this.authBaseUrl,
    required this.wsUrl,
  });

  final String authBaseUrl;
  final String wsUrl;

  Settings copyWith({
    String? authBaseUrl,
    String? wsUrl,
  }) {
    return Settings(
      authBaseUrl: authBaseUrl ?? this.authBaseUrl,
      wsUrl: wsUrl ?? this.wsUrl,
    );
  }
}
