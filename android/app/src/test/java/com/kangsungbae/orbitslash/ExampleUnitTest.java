package com.kangsungbae.orbitslash;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class ExampleUnitTest {
    @Test
    public void usesSafeUnsupportedPluginContract() {
        assertEquals("OrbitSlashGooglePlay", OrbitSlashGooglePlayPlugin.PLUGIN_NAME);
        assertEquals("unsupported", OrbitSlashGooglePlayPlugin.UNSUPPORTED_SESSION_STATUS);
        assertEquals("platform_not_supported", OrbitSlashGooglePlayPlugin.UNSUPPORTED_REASON);
        assertEquals("unsupported", OrbitSlashGooglePlayPlugin.UNSUPPORTED_PURCHASE_STATE);
    }
}
