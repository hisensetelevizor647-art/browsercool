package com.oleksandrcorp.olewser_android

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class OlewserSearchWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        appWidgetIds.forEach { appWidgetId ->
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.olewser_search_widget)
        views.setOnClickPendingIntent(
            R.id.widget_btn_search,
            createActionPendingIntent(context, "olewser://search", 1101)
        )
        views.setOnClickPendingIntent(
            R.id.widget_btn_search_alt,
            createActionPendingIntent(context, "olewser://search-alt", 1102)
        )
        views.setOnClickPendingIntent(
            R.id.widget_btn_ai,
            createActionPendingIntent(context, "olewser://ai", 1103)
        )
        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun createActionPendingIntent(
        context: Context,
        uri: String,
        requestCode: Int
    ): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse(uri)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }
}
