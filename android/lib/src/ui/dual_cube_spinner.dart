import 'dart:async';
import 'package:flutter/material.dart';

class DualCubeThinkingSpinner extends StatefulWidget {
  const DualCubeThinkingSpinner({
    super.key,
    this.size = 20.0,
    this.containerSize = 52.0,
  });

  final double size;
  final double containerSize;

  @override
  State<DualCubeThinkingSpinner> createState() => _DualCubeThinkingSpinnerState();
}

class _DualCubeThinkingSpinnerState extends State<DualCubeThinkingSpinner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  static const Color firstBlockColor = Color(0xFF005BBA);
  static const Color secondBlockColor = Color(0xFFFED500);
  static const Curve customCurve = Cubic(0.0, 0.0, 0.24, 1.21);

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat();
    _animation = CurvedAnimation(
      parent: _controller,
      curve: customCurve,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  // Keyframes for "down" animation:
  // 0% -> (0, 0)
  // 25% -> (1, 0)
  // 50% -> (1, 1)
  // 75% -> (0, 1)
  // 100% -> (0, 0)
  Offset _getDownOffset(double t, double size) {
    if (t <= 0.25) {
      final double progress = t / 0.25;
      return Offset(progress * size, 0);
    } else if (t <= 0.50) {
      final double progress = (t - 0.25) / 0.25;
      return Offset(size, progress * size);
    } else if (t <= 0.75) {
      final double progress = (t - 0.50) / 0.25;
      return Offset(size * (1 - progress), size);
    } else {
      final double progress = (t - 0.75) / 0.25;
      return Offset(0, size * (1 - progress));
    }
  }

  // Keyframes for "up" animation:
  // 0% -> (0, 0)
  // 25% -> (-1, 0)
  // 50% -> (-1, -1)
  // 75% -> (0, -1)
  // 100% -> (0, 0)
  Offset _getUpOffset(double t, double size) {
    if (t <= 0.25) {
      final double progress = t / 0.25;
      return Offset(-progress * size, 0);
    } else if (t <= 0.50) {
      final double progress = (t - 0.25) / 0.25;
      return Offset(-size, -progress * size);
    } else if (t <= 0.75) {
      final double progress = (t - 0.50) / 0.25;
      return Offset(-size * (1 - progress), -size);
    } else {
      final double progress = (t - 0.75) / 0.25;
      return Offset(0, -size * (1 - progress));
    }
  }

  @override
  Widget build(BuildContext context) {
    final double cubeSize = widget.size;
    final double cSize = widget.containerSize;
    final double center = cSize / 2;

    return SizedBox(
      width: cSize,
      height: cSize,
      child: AnimatedBuilder(
        animation: _animation,
        builder: (BuildContext context, Widget? child) {
          final double t = _controller.value;
          final Offset downOffset = _getDownOffset(t, cubeSize);
          final Offset upOffset = _getUpOffset(t, cubeSize);

          return Stack(
            clipBehavior: Clip.none,
            children: <Widget>[
              // Up block (Blue #005bba) starting at center
              Positioned(
                left: center + upOffset.dx,
                top: center + upOffset.dy,
                child: Container(
                  width: cubeSize,
                  height: cubeSize,
                  decoration: BoxDecoration(
                    color: firstBlockColor,
                    borderRadius: BorderRadius.circular(4),
                    boxShadow: <BoxShadow>[
                      BoxShadow(
                        color: firstBlockColor.withOpacity(0.4),
                        blurRadius: 6,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                ),
              ),
              // Down block (Yellow #fed500) starting at center - size
              Positioned(
                left: (center - cubeSize) + downOffset.dx,
                top: (center - cubeSize) + downOffset.dy,
                child: Container(
                  width: cubeSize,
                  height: cubeSize,
                  decoration: BoxDecoration(
                    color: secondBlockColor,
                    borderRadius: BorderRadius.circular(4),
                    boxShadow: <BoxShadow>[
                      BoxShadow(
                        color: secondBlockColor.withOpacity(0.5),
                        blurRadius: 6,
                        spreadRadius: 1,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class ThinkingIndicatorWidget extends StatefulWidget {
  const ThinkingIndicatorWidget({
    super.key,
    required this.languageKey,
    this.modelName,
  });

  final String languageKey;
  final String? modelName;

  @override
  State<ThinkingIndicatorWidget> createState() => _ThinkingIndicatorWidgetState();
}

class _ThinkingIndicatorWidgetState extends State<ThinkingIndicatorWidget> {
  final Stopwatch _stopwatch = Stopwatch();
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _stopwatch.start();
    _timer = Timer.periodic(const Duration(milliseconds: 100), (Timer t) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _stopwatch.stop();
    super.dispose();
  }

  String get _localizedThinkingText {
    switch (widget.languageKey) {
      case 'uk':
      case 'ukrainian':
        return 'Думаю...';
      case 'sk':
      case 'slovak':
        return 'Rozmýšľam...';
      case 'en':
      case 'english':
      default:
        return 'Thinking...';
    }
  }

  @override
  Widget build(BuildContext context) {
    final double elapsedSeconds = _stopwatch.elapsedMilliseconds / 1000.0;
    final String formattedTime = '${elapsedSeconds.toStringAsFixed(1)}s';
    final ColorScheme colors = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: colors.surfaceContainerHighest.withOpacity(0.6),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: colors.primary.withOpacity(0.2),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const DualCubeThinkingSpinner(size: 14, containerSize: 38),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(
                    _localizedThinkingText,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: colors.onSurface,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: colors.primary.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      formattedTime,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: colors.primary,
                      ),
                    ),
                  ),
                ],
              ),
              if (widget.modelName != null && widget.modelName!.isNotEmpty) ...<Widget>[
                const SizedBox(height: 2),
                Text(
                  widget.modelName!,
                  style: TextStyle(
                    fontSize: 11,
                    color: colors.onSurfaceVariant.withOpacity(0.8),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
