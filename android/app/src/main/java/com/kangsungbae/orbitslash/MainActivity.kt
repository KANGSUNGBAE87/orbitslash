package com.kangsungbae.orbitslash

import android.os.Bundle
import com.getcapacitor.BridgeActivity

/**
 * Thin Android container. Shared Pixi gameplay remains in the web bundle; all
 * platform capabilities are exposed through OrbitSlashGooglePlayPlugin only.
 */
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(OrbitSlashGooglePlayPlugin::class.java)
    }
}
