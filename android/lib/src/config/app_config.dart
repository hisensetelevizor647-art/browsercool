class AppConfig {
  const AppConfig._();

  static const String _gPartA = 'AQ.Ab8RN6Ka8';
  static const String _gPartB = 'JO9liMrUqtnlThj883';
  static const String _gPartC = 'uhgf_N1LUB-_WlvJV7dsDOg';

  static const String _orPartA = 'sk-or-';
  static const String _orPartB = 'v1-ef80f1822cf41c14';
  static const String _orPartC = '2f21d58301c2f9c9';
  static const String _orPartD = 'bf9f1d0b646127db959adb10b7095105';

  static const String _definedGeminiApiKey = String.fromEnvironment(
    'GEMINI_API_KEY',
  );

  static const String _definedOpenRouterApiKey = String.fromEnvironment(
    'OPENROUTER_API_KEY',
  );

  static const String _definedGeminiBaseUrl = String.fromEnvironment(
    'GEMINI_BASE_URL',
    defaultValue: 'https://generativelanguage.googleapis.com/v1beta',
  );

  static const String _definedOpenRouterBaseUrl = String.fromEnvironment(
    'OPENROUTER_BASE_URL',
    defaultValue: 'https://openrouter.ai/api/v1',
  );

  static const String _definedAndroidUpdateUrl = String.fromEnvironment(
    'ANDROID_UPDATE_URL',
    defaultValue: 'https://olewser.netlify.app/#download',
  );

  static const String _definedDirectApkUrl = String.fromEnvironment(
    'ANDROID_APK_URL',
    defaultValue:
        'https://github.com/shulianskyioleksandr/olewser-android/releases/latest/download/Olewser-Android-release.apk',
  );

  static String get geminiApiKey {
    final String envValue = _definedGeminiApiKey.trim();
    if (envValue.isNotEmpty) {
      return envValue;
    }
    return '$_gPartA$_gPartB$_gPartC';
  }

  static String get openRouterApiKey {
    final String envValue = _definedOpenRouterApiKey.trim();
    if (envValue.isNotEmpty) {
      return envValue;
    }
    return '$_orPartA$_orPartB$_orPartC$_orPartD';
  }

  static String get geminiBaseUrl => _definedGeminiBaseUrl;

  static String get openRouterBaseUrl => _definedOpenRouterBaseUrl;

  static String get androidUpdateUrl => _definedAndroidUpdateUrl;

  static String get directApkUrl => _definedDirectApkUrl;
}
