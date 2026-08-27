enum AiProvider { googleGenAi, openRouter }

enum ThinkingLevel { off, low, medium, high }

extension ThinkingLevelX on ThinkingLevel {
  String get label {
    switch (this) {
      case ThinkingLevel.off:
        return 'Вимкнено (Off)';
      case ThinkingLevel.low:
        return 'Швидке (Low)';
      case ThinkingLevel.medium:
        return 'Збалансоване (Medium)';
      case ThinkingLevel.high:
        return 'Глибоке (High)';
    }
  }

  String get apiValue {
    switch (this) {
      case ThinkingLevel.off:
        return 'off';
      case ThinkingLevel.low:
        return 'low';
      case ThinkingLevel.medium:
        return 'medium';
      case ThinkingLevel.high:
        return 'high';
    }
  }

  int get budgetTokens {
    switch (this) {
      case ThinkingLevel.off:
        return 0;
      case ThinkingLevel.low:
        return 1024;
      case ThinkingLevel.medium:
        return 4096;
      case ThinkingLevel.high:
        return 8192;
    }
  }
}

enum AiModel {
  ultra40,
  agent40,
  pro40,
  fast40,
}

extension AiModelX on AiModel {
  String get label {
    switch (this) {
      case AiModel.ultra40:
        return '4.0 Ultra';
      case AiModel.agent40:
        return '4.0 Agent';
      case AiModel.pro40:
        return '4.0 Pro';
      case AiModel.fast40:
        return '4.0 Fast';
    }
  }

  String get description {
    switch (this) {
      case AiModel.ultra40:
        return 'Gemini 3.7 Flash з налаштуванням мислення';
      case AiModel.agent40:
        return 'Antigravity Autonomous Agent';
      case AiModel.pro40:
        return 'Cohere North Mini Code (OpenRouter)';
      case AiModel.fast40:
        return 'Liquid LFM 2.5 (OpenRouter)';
    }
  }

  AiProvider get provider {
    switch (this) {
      case AiModel.ultra40:
      case AiModel.agent40:
        return AiProvider.googleGenAi;
      case AiModel.pro40:
      case AiModel.fast40:
        return AiProvider.openRouter;
    }
  }

  String get remoteModel {
    switch (this) {
      case AiModel.ultra40:
        return 'gemini-3.7-flash';
      case AiModel.agent40:
        return 'antigravity-preview-05-2026';
      case AiModel.pro40:
        return 'cohere/north-mini-code:free';
      case AiModel.fast40:
        return 'liquid/lfm-2.5-2.6b:free';
    }
  }

  bool get supportsThinkingConfig {
    return this == AiModel.ultra40;
  }

  bool get isAgent {
    return this == AiModel.agent40;
  }

  double get temperature {
    switch (this) {
      case AiModel.ultra40:
        return 0.7;
      case AiModel.agent40:
        return 0.2;
      case AiModel.pro40:
        return 0.7;
      case AiModel.fast40:
        return 0.7;
    }
  }

  double get topP {
    switch (this) {
      case AiModel.ultra40:
        return 0.95;
      case AiModel.agent40:
        return 0.95;
      case AiModel.pro40:
        return 0.95;
      case AiModel.fast40:
        return 0.95;
    }
  }

  int get maxTokens {
    switch (this) {
      case AiModel.ultra40:
        return 8192;
      case AiModel.agent40:
        return 8192;
      case AiModel.pro40:
        return 4096;
      case AiModel.fast40:
        return 4096;
    }
  }
}
