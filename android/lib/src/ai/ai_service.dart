import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import 'model_catalog.dart';

class AiChatMessage {
  const AiChatMessage({required this.role, required this.content});

  final String role;
  final String content;

  Map<String, String> toJson() => <String, String>{
        'role': role,
        'content': content,
      };
}

class AiGenerationResult {
  const AiGenerationResult({
    required this.text,
    this.reasoningTokens,
    this.modelUsed = '',
  });

  final String text;
  final int? reasoningTokens;
  final String modelUsed;
}

class AiRequestCanceledException implements Exception {
  const AiRequestCanceledException();

  @override
  String toString() => 'Generation stopped';
}

class AiService {
  http.Client? _activeClient;
  bool _cancelRequested = false;

  bool get isGenerating => _activeClient != null;

  Future<AiGenerationResult> complete({
    required AiModel model,
    required List<AiChatMessage> messages,
    ThinkingLevel thinkingLevel = ThinkingLevel.medium,
  }) async {
    if (_activeClient != null) {
      throw Exception('AI is already generating. Stop current response first.');
    }

    final http.Client requestClient = http.Client();
    _activeClient = requestClient;
    _cancelRequested = false;

    try {
      if (model.provider == AiProvider.googleGenAi) {
        return await _completeGoogleGenAi(
          client: requestClient,
          model: model,
          messages: messages,
          thinkingLevel: thinkingLevel,
        );
      } else {
        return await _completeOpenRouter(
          client: requestClient,
          model: model,
          messages: messages,
        );
      }
    } on TimeoutException {
      if (_cancelRequested) {
        throw const AiRequestCanceledException();
      }
      throw Exception('AI request timeout (90s). Please try again.');
    } on http.ClientException catch (e) {
      if (_cancelRequested) {
        throw const AiRequestCanceledException();
      }
      throw Exception('Network error: ${e.message}');
    } finally {
      if (identical(_activeClient, requestClient)) {
        _activeClient = null;
      }
      requestClient.close();
    }
  }

  Future<AiGenerationResult> _completeGoogleGenAi({
    required http.Client client,
    required AiModel model,
    required List<AiChatMessage> messages,
    required ThinkingLevel thinkingLevel,
  }) async {
    final String apiKey = AppConfig.geminiApiKey.trim();
    if (apiKey.isEmpty) {
      throw Exception('Google GenAI API key is empty.');
    }

    final String baseUrl = AppConfig.geminiBaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
    final String modelName = model.remoteModel;
    final Uri endpoint = Uri.parse('$baseUrl/models/$modelName:generateContent?key=$apiKey');

    // Convert chat messages to Google GenAI contents
    final List<Map<String, dynamic>> contents = <Map<String, dynamic>>[];
    for (final AiChatMessage m in messages) {
      final String role = m.role == 'assistant' || m.role == 'model' ? 'model' : 'user';
      contents.add(<String, dynamic>{
        'role': role,
        'parts': <Map<String, dynamic>>[
          <String, dynamic>{'text': m.content}
        ],
      });
    }

    final Map<String, dynamic> generationConfig = <String, dynamic>{
      'temperature': model.temperature,
      'topP': model.topP,
      'maxOutputTokens': model.maxTokens,
    };

    if (model.supportsThinkingConfig && thinkingLevel != ThinkingLevel.off) {
      generationConfig['thinkingConfig'] = <String, dynamic>{
        'thinkingBudget': thinkingLevel.budgetTokens,
      };
    }

    final Map<String, dynamic> payload = <String, dynamic>{
      'contents': contents,
      'generationConfig': generationConfig,
    };

    if (model.isAgent) {
      payload['systemInstruction'] = <String, dynamic>{
        'parts': <Map<String, dynamic>>[
          <String, dynamic>{
            'text':
                'You are Antigravity Preview Agent (05-2026), an advanced autonomous browser & coding agent. '
                'Execute in-depth technical audits, analyze web architectures, diagnose SEO & performance bottlenecks, '
                'and deliver structured, production-ready solutions.'
          }
        ]
      };
    }

    final http.Response response = await client
        .post(
          endpoint,
          headers: <String, String>{
            'Content-Type': 'application/json',
          },
          body: jsonEncode(payload),
        )
        .timeout(const Duration(seconds: 90));

    if (_cancelRequested) {
      throw const AiRequestCanceledException();
    }

    final String responseText = response.body;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_extractGoogleError(response.statusCode, responseText));
    }

    final dynamic decoded = jsonDecode(responseText);
    if (decoded is! Map<String, dynamic>) {
      throw Exception('Invalid Google GenAI response format.');
    }

    final dynamic candidates = decoded['candidates'];
    if (candidates is! List || candidates.isEmpty) {
      throw Exception('Google GenAI did not return any candidates.');
    }

    final dynamic firstCandidate = candidates.first;
    final dynamic content = firstCandidate['content'];
    if (content is! Map<String, dynamic>) {
      throw Exception('Invalid candidate content format.');
    }

    final dynamic parts = content['parts'];
    final StringBuffer outputText = StringBuffer();
    if (parts is List) {
      for (final dynamic part in parts) {
        if (part is Map<String, dynamic>) {
          if (part['text'] is String) {
            outputText.write(part['text']);
          }
        }
      }
    }

    final String resultString = outputText.toString().trim();
    if (resultString.isEmpty) {
      throw Exception('AI returned an empty response.');
    }

    return AiGenerationResult(
      text: resultString,
      modelUsed: model.label,
    );
  }

  Future<AiGenerationResult> _completeOpenRouter({
    required http.Client client,
    required AiModel model,
    required List<AiChatMessage> messages,
  }) async {
    final String apiKey = AppConfig.openRouterApiKey.trim();
    if (apiKey.isEmpty) {
      throw Exception('OpenRouter API key is empty.');
    }

    final String baseUrl = AppConfig.openRouterBaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
    final Uri endpoint = Uri.parse('$baseUrl/chat/completions');

    final Map<String, dynamic> payload = <String, dynamic>{
      'model': model.remoteModel,
      'messages': messages.map((AiChatMessage m) => m.toJson()).toList(),
      'temperature': model.temperature,
      'top_p': model.topP,
      'max_tokens': model.maxTokens,
      'stream': false,
    };

    final http.Response response = await client
        .post(
          endpoint,
          headers: <String, String>{
            'Authorization': 'Bearer $apiKey',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://olewser.app',
            'X-Title': 'Olewser Android',
          },
          body: jsonEncode(payload),
        )
        .timeout(const Duration(seconds: 90));

    if (_cancelRequested) {
      throw const AiRequestCanceledException();
    }

    final String responseText = response.body;
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(_extractOpenRouterError(response.statusCode, responseText));
    }

    final dynamic decoded = jsonDecode(responseText);
    if (decoded is! Map<String, dynamic>) {
      throw Exception('Invalid OpenRouter response format.');
    }

    final dynamic choices = decoded['choices'];
    if (choices is! List || choices.isEmpty) {
      throw Exception('OpenRouter response did not include choices.');
    }

    final dynamic first = choices.first;
    if (first is! Map<String, dynamic>) {
      throw Exception('Invalid choice format.');
    }

    final dynamic message = first['message'];
    if (message is! Map<String, dynamic>) {
      throw Exception('Missing message in response.');
    }

    final dynamic content = message['content'];
    final String text = _normalizeContent(content);
    if (text.trim().isEmpty) {
      throw Exception('AI returned an empty answer.');
    }

    int? reasoningTokens;
    final dynamic usage = decoded['usage'];
    if (usage is Map<String, dynamic>) {
      final dynamic details = usage['completion_tokens_details'];
      if (details is Map<String, dynamic>) {
        final dynamic rTokens = details['reasoning_tokens'];
        if (rTokens is int) {
          reasoningTokens = rTokens;
        }
      }
    }

    return AiGenerationResult(
      text: text,
      reasoningTokens: reasoningTokens,
      modelUsed: model.label,
    );
  }

  void cancelCurrent() {
    _cancelRequested = true;
    _activeClient?.close();
    _activeClient = null;
  }

  void dispose() {
    cancelCurrent();
  }

  String _extractGoogleError(int statusCode, String responseText) {
    try {
      final dynamic decoded = jsonDecode(responseText);
      if (decoded is Map<String, dynamic>) {
        final dynamic error = decoded['error'];
        if (error is Map<String, dynamic>) {
          final dynamic message = error['message'];
          if (message is String && message.trim().isNotEmpty) {
            return 'Google AI ($statusCode): $message';
          }
        }
      }
    } catch (_) {}
    return 'Google AI error ($statusCode).';
  }

  String _extractOpenRouterError(int statusCode, String responseText) {
    try {
      final dynamic decoded = jsonDecode(responseText);
      if (decoded is Map<String, dynamic>) {
        final dynamic error = decoded['error'];
        if (error is Map<String, dynamic>) {
          final dynamic message = error['message'];
          if (message is String && message.trim().isNotEmpty) {
            return 'OpenRouter ($statusCode): $message';
          }
        }
      }
    } catch (_) {}
    return 'OpenRouter request failed ($statusCode).';
  }

  String _normalizeContent(dynamic content) {
    if (content is String) {
      return content;
    }
    if (content is List) {
      final StringBuffer text = StringBuffer();
      for (final dynamic item in content) {
        if (item is Map<String, dynamic>) {
          final dynamic part = item['text'];
          if (part is String) {
            text.write(part);
          }
        }
      }
      return text.toString();
    }
    return content?.toString() ?? '';
  }
}
