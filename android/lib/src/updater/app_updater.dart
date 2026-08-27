import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class AppUpdater {
  static const MethodChannel _channel =
      MethodChannel('com.oleksandrcorp.olewser/installer');

  static Future<bool> installApk(String filePath) async {
    try {
      final bool? result = await _channel.invokeMethod<bool>('installApk', <String, dynamic>{
        'filePath': filePath,
      });
      return result ?? false;
    } catch (e) {
      debugPrint('Install APK error: $e');
      return false;
    }
  }

  static Future<String> downloadApk({
    required String downloadUrl,
    required void Function(double progress, int receivedBytes, int totalBytes) onProgress,
    required void Function(String error) onError,
  }) async {
    final http.Client client = http.Client();
    try {
      final Uri uri = Uri.parse(downloadUrl);
      final http.Request request = http.Request('GET', uri);
      final http.StreamedResponse response = await client.send(request);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('Download failed with HTTP ${response.statusCode}');
      }

      final int totalBytes = response.contentLength ?? 0;
      int receivedBytes = 0;

      final Directory tempDir = Directory.systemTemp;
      final String filePath = '${tempDir.path}/olewser-update.apk';
      final File targetFile = File(filePath);
      if (await targetFile.exists()) {
        await targetFile.delete();
      }
      final IOSink sink = targetFile.openWrite();

      await for (final List<int> chunk in response.stream) {
        sink.add(chunk);
        receivedBytes += chunk.length;
        if (totalBytes > 0) {
          final double progress = receivedBytes / totalBytes;
          onProgress(progress, receivedBytes, totalBytes);
        } else {
          onProgress(0.5, receivedBytes, totalBytes);
        }
      }

      await sink.flush();
      await sink.close();
      return filePath;
    } catch (e) {
      onError(e.toString());
      rethrow;
    } finally {
      client.close();
    }
  }
}

class UpdateDownloadDialog extends StatefulWidget {
  const UpdateDownloadDialog({super.key});

  @override
  State<UpdateDownloadDialog> createState() => _UpdateDownloadDialogState();
}

class _UpdateDownloadDialogState extends State<UpdateDownloadDialog> {
  bool _isDownloading = false;
  double _progress = 0.0;
  int _receivedBytes = 0;
  int _totalBytes = 0;
  String? _downloadedFilePath;
  String? _errorMessage;

  Future<void> _startDownload() async {
    setState(() {
      _isDownloading = true;
      _progress = 0.0;
      _receivedBytes = 0;
      _totalBytes = 0;
      _downloadedFilePath = null;
      _errorMessage = null;
    });

    try {
      final String path = await AppUpdater.downloadApk(
        downloadUrl: AppConfig.directApkUrl,
        onProgress: (double progress, int received, int total) {
          if (mounted) {
            setState(() {
              _progress = progress;
              _receivedBytes = received;
              _totalBytes = total;
            });
          }
        },
        onError: (String err) {
          if (mounted) {
            setState(() {
              _errorMessage = err;
              _isDownloading = false;
            });
          }
        },
      );

      if (mounted) {
        setState(() {
          _isDownloading = false;
          _downloadedFilePath = path;
          _progress = 1.0;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isDownloading = false;
        });
      }
    }
  }

  Future<void> _installDownloadedApk() async {
    if (_downloadedFilePath == null) {
      return;
    }
    final bool success = await AppUpdater.installApk(_downloadedFilePath!);
    if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Не вдалося запустити встановлення APK')),
      );
    }
  }

  String _formatBytes(int bytes) {
    if (bytes <= 0) return '0 MB';
    final double mb = bytes / (1024 * 1024);
    return '${mb.toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final ColorScheme colors = Theme.of(context).colorScheme;

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: Row(
        children: <Widget>[
          Icon(Icons.system_update_rounded, color: colors.primary),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Оновлення Olewser',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (_errorMessage != null)
            Container(
              padding: const EdgeInsets.all(10),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: colors.errorContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'Помилка: $_errorMessage',
                style: TextStyle(fontSize: 12, color: colors.onErrorContainer),
              ),
            ),
          if (!_isDownloading && _downloadedFilePath == null)
            const Text(
              'Доступна нова версія додатка. Натисніть кнопку нижче, щоб завантажити APK та встановити оновлення.',
              style: TextStyle(fontSize: 14),
            ),
          if (_isDownloading) ...<Widget>[
            Text(
              'Завантаження оновлення... ${(_progress * 100).toInt()}%',
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 10),
            LinearProgressIndicator(
              value: _progress > 0 ? _progress : null,
              borderRadius: BorderRadius.circular(8),
            ),
            const SizedBox(height: 6),
            Text(
              '${_formatBytes(_receivedBytes)} / ${_formatBytes(_totalBytes)}',
              style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant),
            ),
          ],
          if (_downloadedFilePath != null) ...<Widget>[
            Row(
              children: <Widget>[
                const Icon(Icons.check_circle_rounded, color: Colors.green),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Оновлення успішно завантажено (${_formatBytes(_receivedBytes)})!',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Натисніть кнопку, щоб перезавантажити та встановити нову версію APK.',
              style: TextStyle(fontSize: 13),
            ),
          ],
        ],
      ),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Скасувати'),
        ),
        if (!_isDownloading && _downloadedFilePath == null)
          FilledButton.icon(
            icon: const Icon(Icons.download_rounded),
            label: const Text('Завантажити оновлення'),
            onPressed: _startDownload,
          ),
        if (_downloadedFilePath != null)
          FilledButton.icon(
            icon: const Icon(Icons.restart_alt_rounded),
            label: const Text('Перезавантажити та встановити'),
            onPressed: _installDownloadedApk,
          ),
      ],
    );
  }
}
