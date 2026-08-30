package com.oleksandrcorp.olewser_android

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.util.Locale

class MainActivity : FlutterActivity(), TextToSpeech.OnInitListener {
    private val INSTALL_CHANNEL = "com.oleksandrcorp.olewser/installer"
    private val TTS_CHANNEL = "com.oleksandrcorp.olewser/tts"

    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var ttsChannel: MethodChannel? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        tts = TextToSpeech(this, this)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            ttsReady = true
            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    runOnUiThread {
                        ttsChannel?.invokeMethod("onTtsStart", utteranceId)
                    }
                }

                override fun onDone(utteranceId: String?) {
                    runOnUiThread {
                        ttsChannel?.invokeMethod("onTtsDone", utteranceId)
                    }
                }

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) {
                    runOnUiThread {
                        ttsChannel?.invokeMethod("onTtsError", utteranceId)
                    }
                }
            })
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // APK Installer Channel
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
                        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or 
                                       Intent.FLAG_GRANT_READ_URI_PERMISSION or 
                                       Intent.FLAG_ACTIVITY_CLEAR_TOP
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

        // Native TextToSpeech Channel
        ttsChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, TTS_CHANNEL).apply {
            setMethodCallHandler { call, result ->
                when (call.method) {
                    "speak" -> {
                        val text = call.argument<String>("text") ?: ""
                        val lang = call.argument<String>("languageKey") ?: "uk"
                        if (!ttsReady || tts == null) {
                            result.error("TTS_NOT_READY", "TextToSpeech is initializing", null)
                            return@setMethodCallHandler
                        }
                        val locale = when (lang.lowercase()) {
                            "uk", "ukrainian" -> Locale("uk", "UA")
                            "sk", "slovak" -> Locale("sk", "SK")
                            "en", "english" -> Locale.US
                            else -> Locale.getDefault()
                        }
                        tts?.language = locale
                        val utteranceId = "live_utterance_${System.currentTimeMillis()}"
                        tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
                        result.success(true)
                    }
                    "stop" -> {
                        tts?.stop()
                        result.success(true)
                    }
                    "isSpeaking" -> {
                        result.success(tts?.isSpeaking ?: false)
                    }
                    else -> result.notImplemented()
                }
            }
        }
    }

    override fun onDestroy() {
        tts?.stop()
        tts?.shutdown()
        super.onDestroy()
    }
}
