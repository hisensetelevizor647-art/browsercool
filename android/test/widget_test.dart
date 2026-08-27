import 'package:flutter_test/flutter_test.dart';
import 'package:olewser/src/ai/model_catalog.dart';
import 'package:olewser/src/config/app_config.dart';

void main() {
  test('AI Models catalog verification', () {
    expect(AiModel.ultra40.label, '4.0 Ultra');
    expect(AiModel.agent40.label, '4.0 Agent');
    expect(AiModel.pro40.label, '4.0 Pro');
    expect(AiModel.fast40.label, '4.0 Fast');

    expect(AiModel.ultra40.remoteModel, 'gemini-3.7-flash');
    expect(AiModel.agent40.remoteModel, 'antigravity-preview-05-2026');
    expect(AiModel.pro40.remoteModel, 'cohere/north-mini-code:free');
    expect(AiModel.fast40.remoteModel, 'liquid/lfm-2.5-2.6b:free');

    expect(AiModel.ultra40.supportsThinkingConfig, true);
    expect(ThinkingLevel.medium.apiValue, 'medium');
  });

  test('AppConfig embedded keys verification', () {
    expect(AppConfig.geminiApiKey.startsWith('AQ.Ab8'), true);
    expect(AppConfig.geminiApiKey.endsWith('dsDOg'), true);
    expect(AppConfig.openRouterApiKey.startsWith('sk-or-v1-'), true);
    expect(AppConfig.openRouterApiKey.endsWith('105'), true);
  });
}
