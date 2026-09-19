package com.kangsungbae.orbitslash

import android.view.HapticFeedbackConstants
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Safe Capacitor contract only. Credential, Billing and rewarded-ad providers
 * are deliberately absent until their server verification/configuration exists.
 */
@CapacitorPlugin(name = OrbitSlashGooglePlayPlugin.PLUGIN_NAME)
class OrbitSlashGooglePlayPlugin : Plugin() {
    companion object {
        const val PLUGIN_NAME = "OrbitSlashGooglePlay"
        const val UNSUPPORTED_SESSION_STATUS = "unsupported"
        const val UNSUPPORTED_REASON = "platform_not_supported"
        const val UNSUPPORTED_PURCHASE_STATE = "unsupported"
    }

    private val preferences by lazy {
        context.getSharedPreferences("orbitslash_platform", android.content.Context.MODE_PRIVATE)
    }

    override fun handleOnPause() {
        emitLifecycle("background")
    }

    override fun handleOnResume() {
        emitLifecycle("foreground")
    }

    @PluginMethod
    fun getVerifiedSession(call: PluginCall) {
        // No Credential Manager configuration yet: never fabricate identity or token.
        call.resolve(JSObject().put("status", UNSUPPORTED_SESSION_STATUS))
    }

    @PluginMethod
    fun rewardedAdCapability(call: PluginCall) {
        call.resolve(JSObject().put("supported", false).put("reason", UNSUPPORTED_REASON))
    }

    @PluginMethod
    fun showRewardedAd(call: PluginCall) {
        call.resolve(
            JSObject()
                .put("shown", false)
                .put("rewarded", false)
                .put("rewardEarned", false)
                .put("dismissed", false)
                .put("reason", UNSUPPORTED_REASON),
        )
    }

    @PluginMethod
    fun purchase(call: PluginCall) {
        val productId = call.getString("productId") ?: return call.reject("product_id_required")
        // Store configuration and server-side receipt verification are not ready.
        call.resolve(JSObject().put("productId", productId).put("state", UNSUPPORTED_PURCHASE_STATE))
    }

    @PluginMethod
    fun restorePurchases(call: PluginCall) {
        call.resolve(JSObject().put("supported", false).put("productIds", JSArray()))
    }

    @PluginMethod
    fun storageGet(call: PluginCall) {
        val key = call.getString("key") ?: return call.reject("storage_key_required")
        val value = preferences.getString(key, null)
        call.resolve(JSObject().put("value", value))
    }

    @PluginMethod
    fun storageSet(call: PluginCall) {
        val key = call.getString("key") ?: return call.reject("storage_key_required")
        val value = call.getString("value") ?: return call.reject("storage_value_required")
        preferences.edit().putString(key, value).apply()
        call.resolve()
    }

    @PluginMethod
    fun haptic(call: PluginCall) {
        val feedback = when (call.getString("kind")) {
            "heavy" -> HapticFeedbackConstants.LONG_PRESS
            "medium" -> HapticFeedbackConstants.CONTEXT_CLICK
            else -> HapticFeedbackConstants.KEYBOARD_TAP
        }
        activity?.window?.decorView?.performHapticFeedback(feedback)
        call.resolve()
    }

    @PluginMethod
    fun getSafeAreaInsets(call: PluginCall) {
        val view = activity?.window?.decorView
        val insets = view?.let { ViewCompat.getRootWindowInsets(it) }
            ?.getInsets(WindowInsetsCompat.Type.systemBars())
        call.resolve(
            JSObject()
                .put("top", insets?.top ?: 0)
                .put("right", insets?.right ?: 0)
                .put("bottom", insets?.bottom ?: 0)
                .put("left", insets?.left ?: 0),
        )
    }

    private fun emitLifecycle(state: String) {
        notifyListeners("lifecycle", JSObject().put("state", state), true)
    }
}
