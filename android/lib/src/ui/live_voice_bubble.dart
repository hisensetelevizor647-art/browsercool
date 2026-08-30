import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

import '../ai/ai_service.dart';
import '../ai/model_catalog.dart';
import 'liquid_glass.dart';

/// Native Android Text-to-Speech client
class NativeTtsService {
  static const MethodChannel _channel = MethodChannel('com.oleksandrcorp.olewser/tts');
  static Function(bool isSpeaking)? onSpeakingStateChanged;

  static void initialize() {
    _channel.setMethodCallHandler((MethodCall call) async {
      switch (call.method) {
        case 'onTtsStart':
          onSpeakingStateChanged?.call(true);
          break;
        case 'onTtsDone':
        case 'onTtsError':
          onSpeakingStateChanged?.call(false);
          break;
      }
    });
  }

  static Future<void> speak(String text, {String languageKey = 'uk'}) async {
    try {
      await _channel.invokeMethod('speak', <String, dynamic>{
        'text': text,
        'languageKey': languageKey,
      });
    } catch (_) {}
  }

  static Future<void> stop() async {
    try {
      await _channel.invokeMethod('stop');
      onSpeakingStateChanged?.call(false);
    } catch (_) {}
  }

  static Future<bool> isSpeaking() async {
    try {
      final bool? res = await _channel.invokeMethod<bool>('isSpeaking');
      return res ?? false;
    } catch (_) {
      return false;
    }
  }
}

enum LiveVoiceState {
  idle,
  listening,
  thinking,
  speaking,
}

/// Reactive pulsating audio orb with animated ripples & soundwave bars
class LiveVoiceOrbWidget extends StatefulWidget {
  const LiveVoiceOrbWidget({
    super.key,
    required this.state,
    this.soundLevel = 0.0,
    this.onTap,
  });

  final LiveVoiceState state;
  final double soundLevel; // 0.0 to 1.0 (from microphone)
  final VoidCallback? onTap;

  @override
  State<LiveVoiceOrbWidget> createState() => _LiveVoiceOrbWidgetState();
}

class _LiveVoiceOrbWidgetState extends State<LiveVoiceOrbWidget>
    with TickerProviderStateMixin {
  late final AnimationController _pulseController;
  late final AnimationController _waveController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);

    _waveController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _waveController.dispose();
    super.dispose();
  }

  List<Color> get _orbColors {
    switch (widget.state) {
      case LiveVoiceState.listening:
        return const <Color>[Color(0xFF00C6FF), Color(0xFF0072FF), Color(0xFF00F5D4)];
      case LiveVoiceState.thinking:
        return const <Color>[Color(0xFF8E2DE2), Color(0xFF4A00E0), Color(0xFFF72585)];
      case LiveVoiceState.speaking:
        return const <Color>[Color(0xFFFF512F), Color(0xFFDD2476), Color(0xFFFF9900)];
      case LiveVoiceState.idle:
      default:
        return const <Color>[Color(0xFF3A7BD5), Color(0xFF3A6073)];
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      child: SizedBox(
        width: 140,
        height: 140,
        child: AnimatedBuilder(
          animation: Listenable.merge(<Listenable>[_pulseController, _waveController]),
          builder: (BuildContext context, Widget? child) {
            final double pulse = _pulseController.value;
            final double extraScale = widget.state == LiveVoiceState.listening
                ? (widget.soundLevel * 0.35)
                : (widget.state == LiveVoiceState.speaking ? 0.15 * math.sin(_waveController.value * math.pi * 2) : 0.0);

            final double coreScale = 1.0 + (pulse * 0.08) + extraScale;
            final List<Color> colors = _orbColors;

            return Stack(
              alignment: Alignment.center,
              children: <Widget>[
                // Outer Ripple Ring 1
                if (widget.state != LiveVoiceState.idle)
                  Container(
                    width: 130 * (1.0 + pulse * 0.22 + extraScale),
                    height: 130 * (1.0 + pulse * 0.22 + extraScale),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: colors.first.withOpacity(0.25 * (1 - pulse)),
                        width: 2,
                      ),
                    ),
                  ),
                // Outer Ripple Ring 2
                if (widget.state == LiveVoiceState.speaking || widget.state == LiveVoiceState.listening)
                  Container(
                    width: 110 * (1.0 + ((pulse + 0.5) % 1.0) * 0.2 + extraScale),
                    height: 110 * (1.0 + ((pulse + 0.5) % 1.0) * 0.2 + extraScale),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: colors[1].withOpacity(0.35 * (1 - pulse)),
                        width: 1.5,
                      ),
                    ),
                  ),
                // Glowing Backdrop Blur
                Container(
                  width: 86 * coreScale,
                  height: 86 * coreScale,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: <BoxShadow>[
                      BoxShadow(
                        color: colors.first.withOpacity(0.55),
                        blurRadius: 28,
                        spreadRadius: 6,
                      ),
                      BoxShadow(
                        color: colors.last.withOpacity(0.40),
                        blurRadius: 36,
                        spreadRadius: 10,
                      ),
                    ],
                  ),
                ),
                // Core Gradient Sphere
                Transform.scale(
                  scale: coreScale,
                  child: Container(
                    width: 78,
                    height: 78,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: <Color>[
                          Colors.white.withOpacity(0.9),
                          colors.first,
                          colors.last,
                        ],
                        stops: const <double>[0.0, 0.45, 1.0],
                        center: const Alignment(-0.25, -0.3),
                      ),
                    ),
                    child: Center(
                      child: _buildOrbIcon(),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildOrbIcon() {
    switch (widget.state) {
      case LiveVoiceState.listening:
        return const Icon(Icons.graphic_eq_rounded, color: Colors.white, size: 32);
      case LiveVoiceState.thinking:
        return const Icon(Icons.auto_awesome_rounded, color: Colors.white, size: 28);
      case LiveVoiceState.speaking:
        return const Icon(Icons.volume_up_rounded, color: Colors.white, size: 30);
      case LiveVoiceState.idle:
      default:
        return const Icon(Icons.mic_none_rounded, color: Colors.white, size: 28);
    }
  }
}

/// Live Voice Bubble Bottom Sheet modal
class LiveVoiceBubbleSheet extends StatefulWidget {
  const LiveVoiceBubbleSheet({
    super.key,
    required this.aiService,
    required this.speech,
    required this.speechReady,
    required this.languageKey,
    this.speechLocaleId = 'uk_UA',
    this.pageContext,
    this.initialModel = AiModel.fast40,
  });

  final AiService aiService;
  final stt.SpeechToText speech;
  final bool speechReady;
  final String languageKey;
  final String speechLocaleId;
  final String? pageContext;
  final AiModel initialModel;

  @override
  State<LiveVoiceBubbleSheet> createState() => _LiveVoiceBubbleSheetState();
}

class _LiveVoiceBubbleSheetState extends State<LiveVoiceBubbleSheet> {
  late AiModel _currentModel;
  LiveVoiceState _state = LiveVoiceState.idle;
  String _userSpeech = '';
  String _aiReply = '';
  double _soundLevel = 0.0;
  Timer? _silenceTimer;

  @override
  void initState() {
    super.initState();
    _currentModel = widget.initialModel;
    NativeTtsService.initialize();
    NativeTtsService.onSpeakingStateChanged = (bool isSpeaking) {
      if (!mounted) return;
      setState(() {
        if (isSpeaking) {
          _state = LiveVoiceState.speaking;
        } else {
          _state = LiveVoiceState.idle;
        }
      });
    };

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startListening();
    });
  }

  @override
  void dispose() {
    _silenceTimer?.cancel();
    NativeTtsService.stop();
    if (widget.speech.isListening) {
      widget.speech.stop();
    }
    super.dispose();
  }

  Future<void> _startListening() async {
    await NativeTtsService.stop();
    if (!widget.speechReady) return;

    setState(() {
      _state = LiveVoiceState.listening;
      _userSpeech = '';
    });

    try {
      await widget.speech.listen(
        onResult: (SpeechRecognitionResult result) {
          if (!mounted) return;
          setState(() {
            _userSpeech = result.recognizedWords;
          });

          _silenceTimer?.cancel();
          if (result.finalResult || _userSpeech.trim().length > 3) {
            _silenceTimer = Timer(const Duration(milliseconds: 1400), () {
              if (_userSpeech.trim().isNotEmpty && _state == LiveVoiceState.listening) {
                _processUserSpeech(_userSpeech.trim());
              }
            });
          }
        },
        onSoundLevelChange: (double level) {
          if (!mounted) return;
          setState(() {
            _soundLevel = (level.clamp(-2.0, 10.0) + 2.0) / 12.0;
          });
        },
        listenOptions: stt.SpeechListenOptions(
          partialResults: true,
          cancelOnError: false,
          listenMode: stt.ListenMode.dictation,
        ),
        localeId: widget.speechLocaleId,
      );
    } catch (_) {}
  }

  Future<void> _processUserSpeech(String prompt) async {
    if (prompt.isEmpty) return;
    if (widget.speech.isListening) {
      await widget.speech.stop();
    }

    setState(() {
      _state = LiveVoiceState.thinking;
    });

    final List<AiChatMessage> messages = <AiChatMessage>[
      AiChatMessage(
        role: 'system',
        content: 'You are OleksandrAi in fast Live Voice Mode. '
            'Keep answers very concise, direct, natural, conversational, and max 1-3 sentences for speech. '
            'Reply in the user\'s language (${widget.languageKey}).'
            '${widget.pageContext != null ? " Current web page context: ${widget.pageContext}" : ""}',
      ),
      AiChatMessage(role: 'user', content: prompt),
    ];

    try {
      final AiGenerationResult result = await widget.aiService.complete(
        model: _currentModel,
        messages: messages,
      );

      if (!mounted) return;

      setState(() {
        _aiReply = result.text.trim();
        _state = LiveVoiceState.speaking;
      });

      await NativeTtsService.speak(_aiReply, languageKey: widget.languageKey);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _aiReply = 'Вибачте, виникла помилка з\'єднання.';
        _state = LiveVoiceState.idle;
      });
      await NativeTtsService.speak(_aiReply, languageKey: widget.languageKey);
    }
  }

  void _toggleListening() {
    if (_state == LiveVoiceState.listening) {
      widget.speech.stop();
      setState(() {
        _state = LiveVoiceState.idle;
      });
    } else if (_state == LiveVoiceState.speaking) {
      NativeTtsService.stop();
      _startListening();
    } else {
      _startListening();
    }
  }

  String get _statusLabel {
    switch (_state) {
      case LiveVoiceState.listening:
        return 'Слухаю вас...';
      case LiveVoiceState.thinking:
        return 'Міркую (${_currentModel.label})...';
      case LiveVoiceState.speaking:
        return 'Відповідаю...';
      case LiveVoiceState.idle:
      default:
        return 'Натисніть на сферу, щоб говорити';
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool isDark = Theme.of(context).brightness == Brightness.dark;
    final ColorScheme colors = Theme.of(context).colorScheme;

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 12,
          right: 12,
          bottom: 12 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: LiquidGlassContainer(
          borderRadius: 32,
          blurSigma: 26,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              // Header Row with Model Indicator & Close Button
              Row(
                children: <Widget>[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: colors.primary.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: colors.primary.withOpacity(0.24),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        const Icon(Icons.graphic_eq_rounded, size: 14, color: Colors.blueAccent),
                        const SizedBox(width: 6),
                        Text(
                          'Live Mode • ${_currentModel.label}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: colors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Spacer(),
                  // Model quick switch
                  PopupMenuButton<AiModel>(
                    initialValue: _currentModel,
                    onSelected: (AiModel m) {
                      setState(() {
                        _currentModel = m;
                      });
                    },
                    itemBuilder: (BuildContext context) => AiModel.values
                        .map(
                          (AiModel m) => PopupMenuItem<AiModel>(
                            value: m,
                            child: Text(m.label),
                          ),
                        )
                        .toList(),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: colors.surfaceContainerHighest.withOpacity(0.5),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          Text(
                            _currentModel.label,
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                          ),
                          const Icon(Icons.arrow_drop_down_rounded, size: 16),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded, size: 20),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Animated Reactive Live Audio Orb
              Center(
                child: LiveVoiceOrbWidget(
                  state: _state,
                  soundLevel: _soundLevel,
                  onTap: _toggleListening,
                ),
              ),
              const SizedBox(height: 14),

              // Status indicator pill
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: Container(
                  key: ValueKey<String>(_statusLabel),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _statusLabel,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: colors.onSurface,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Live Transcription & Response Card
              if (_userSpeech.isNotEmpty || _aiReply.isNotEmpty)
                Container(
                  width: double.infinity,
                  constraints: const BoxConstraints(maxHeight: 140),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white.withOpacity(0.05) : Colors.black.withOpacity(0.03),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.05),
                    ),
                  ),
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        if (_userSpeech.isNotEmpty) ...<Widget>[
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              const Icon(Icons.mic_rounded, size: 14, color: Colors.blueAccent),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  _userSpeech,
                                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          ),
                          if (_aiReply.isNotEmpty) const Divider(height: 12),
                        ],
                        if (_aiReply.isNotEmpty) ...<Widget>[
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              const Icon(Icons.auto_awesome_rounded, size: 14, color: Colors.amber),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  _aiReply,
                                  style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 12),

              // Bottom Action Controls
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: <Widget>[
                  // Mic control button
                  FilledButton.tonalIcon(
                    onPressed: _toggleListening,
                    icon: Icon(
                      _state == LiveVoiceState.listening
                          ? Icons.pause_rounded
                          : (_state == LiveVoiceState.speaking ? Icons.stop_rounded : Icons.mic_rounded),
                    ),
                    label: Text(
                      _state == LiveVoiceState.listening
                          ? 'Пауза'
                          : (_state == LiveVoiceState.speaking ? 'Зупинити озвучку' : 'Говорити'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}