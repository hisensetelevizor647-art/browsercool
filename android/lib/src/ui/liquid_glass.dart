import 'package:flutter/material.dart';

class LiquidGlassContainer extends StatelessWidget {
  const LiquidGlassContainer({
    super.key,
    required this.child,
    this.borderRadius = 24.0,
    this.blurSigma = 20.0,
    this.padding,
    this.margin,
    this.tintColor,
    this.borderColor,
    this.borderWidth = 1.0,
    this.shadowColor,
    this.elevation = 8.0,
  });

  final Widget child;
  final double borderRadius;
  final double blurSigma;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? tintColor;
  final Color? borderColor;
  final double borderWidth;
  final Color? shadowColor;
  final double elevation;

  @override
  Widget build(BuildContext context) {
    final bool isDark = Theme.of(context).brightness == Brightness.dark;
    final ColorScheme colors = Theme.of(context).colorScheme;

    final Color effectiveTint = tintColor ??
        (isDark
            ? colors.surface.withOpacity(0.68)
            : colors.surface.withOpacity(0.78));

    final Color effectiveBorder = borderColor ??
        (isDark
            ? Colors.white.withOpacity(0.18)
            : colors.primary.withOpacity(0.12));

    final Color effectiveShadow = shadowColor ??
        (isDark
            ? Colors.black.withOpacity(0.35)
            : colors.primary.withOpacity(0.08));

    return Container(
      margin: margin,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: <BoxShadow>[
          if (elevation > 0)
            BoxShadow(
              color: effectiveShadow,
              blurRadius: elevation * 2,
              spreadRadius: 0,
              offset: Offset(0, elevation * 0.5),
            ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
          child: Container(
            padding: padding,
            decoration: BoxDecoration(
              color: effectiveTint,
              borderRadius: BorderRadius.circular(borderRadius),
              border: Border.all(
                color: effectiveBorder,
                width: borderWidth,
              ),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isDark
                    ? <Color>[
                        Colors.white.withOpacity(0.10),
                        Colors.white.withOpacity(0.02),
                        Colors.black.withOpacity(0.15),
                      ]
                    : <Color>[
                        Colors.white.withOpacity(0.85),
                        Colors.white.withOpacity(0.45),
                        Colors.white.withOpacity(0.20),
                      ],
              ),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

class LiquidGlassCard extends StatelessWidget {
  const LiquidGlassCard({
    super.key,
    required this.child,
    this.borderRadius = 20.0,
    this.padding = const EdgeInsets.all(12),
    this.onTap,
  });

  final Widget child;
  final double borderRadius;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final Widget content = LiquidGlassContainer(
      borderRadius: borderRadius,
      padding: padding,
      child: child,
    );

    if (onTap == null) {
      return content;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(borderRadius),
        onTap: onTap,
        child: content,
      ),
    );
  }
}
