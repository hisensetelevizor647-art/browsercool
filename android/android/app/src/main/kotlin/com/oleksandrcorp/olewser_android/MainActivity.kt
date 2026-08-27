package com.oleksandrcorp.olewser_android

import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    private val INSTALL_CHANNEL = "com.oleksandrcorp.olewser/installer"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, INSTALL_CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "installApk") {
                val filePath = call.argument<String>("filePath")
                if (filePath != null) {
                    try {
                        val file = File(filePath)
                        if (!file.exists()) {
                            result.error("FILE_NOT_FOUND", "APK file does not exist", null)
                            return@setMethodCallHandler
                        }
                        val intent = Intent(Intent.ACTION_VIEW)
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
                        val uri = FileProvider.getUriForFile(
                            applicationContext,
                            "${applicationContext.packageName}.fileprovider",
                            file
                        )
                        intent.setDataAndType(uri, "application/vnd.android.package-archive")
                        startActivity(intent)
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("INSTALL_ERROR", e.message, null)
                    }
                } else {
                    result.error("INVALID_PATH", "filePath is null", null)
                }
            } else {
                result.notImplemented()
            }
        }
    }
}
