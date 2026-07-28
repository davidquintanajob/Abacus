package com.abacus.app.exportmodule

import android.content.ContentResolver
import android.content.ContentValues
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.annotation.NonNull
import com.facebook.react.bridge.*
import java.io.*

class ExportModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "ExportModule"
    }

    @ReactMethod
    fun saveFile(options: ReadableMap, promise: Promise) {
        try {
            val filename = options.getString("filename")
            val mimeType = options.getString("mimeType")
            val base64 = options.getString("base64")

            if (filename == null || mimeType == null || base64 == null) {
                promise.reject("INVALID_ARGUMENTS", "filename, mimeType, and base64 are required")
                return
            }

            // Decode base64 to bytes
            val fileBytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT)

            // Save using MediaStore
            val uri = saveToMediaStore(filename, mimeType, fileBytes)

            if (uri != null) {
                promise.resolve(uri.toString())
            } else {
                promise.reject("SAVE_FAILED", "Failed to save file to MediaStore")
            }
        } catch (e: Exception) {
            promise.reject("SAVE_ERROR", e.message, e)
        }
    }

    private fun saveToMediaStore(filename: String, mimeType: String, bytes: ByteArray): android.net.Uri? {
        val resolver = currentActivity?.contentResolver ?: return null

        val contentValues = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
            put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ (API 29+)
                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
        }

        val collection = when {
            mimeType.startsWith("image/") -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            mimeType.startsWith("video/") -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
            mimeType.startsWith("audio/") -> MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
            else -> MediaStore.Files.getContentUri("external")
        }

        val uri = resolver.insert(collection, contentValues) ?: return null

        try {
            resolver.openOutputStream(uri)?.use { outputStream ->
                outputStream.write(bytes)
                outputStream.flush()
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                contentValues.clear()
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                resolver.update(uri, contentValues, null, null)
            }

            return uri
        } catch (e: Exception) {
            // If failed, try to delete the inserted entry
            try {
                resolver.delete(uri, null, null)
            } catch (deleteException: Exception) {
                // Ignore delete error
            }
            return null
        }
    }

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ doesn't need storage permissions for MediaStore
                promise.resolve(true)
            } else {
                // Android 9 and below need storage permissions
                // For now, return true and let the app handle permission requests
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", e.message, e)
        }
    }
}
