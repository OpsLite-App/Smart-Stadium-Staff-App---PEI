import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'routing/app_router.dart';
import 'realtime/emergency_snackbar_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: OpsLiteApp()));
}

class OpsLiteApp extends ConsumerWidget {
  const OpsLiteApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);
    final messengerKey = ref.watch(scaffoldMessengerKeyProvider);

    ref.watch(emergencySnackbarProvider);

    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'OpsLite Staff',
      routerConfig: router,
      scaffoldMessengerKey: messengerKey,
    );
  }
}
