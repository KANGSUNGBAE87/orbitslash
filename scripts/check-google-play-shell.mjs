#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "capacitor.config.ts",
  "android/settings.gradle",
  "android/build.gradle",
  "android/app/build.gradle",
  "android/app/src/main/AndroidManifest.xml",
  "android/app/src/main/java/com/kangsungbae/orbitslash/MainActivity.kt",
  "android/app/src/main/java/com/kangsungbae/orbitslash/OrbitSlashGooglePlayPlugin.kt",
  "android/app/src/androidTest/java/com/kangsungbae/orbitslash/ExampleInstrumentedTest.java",
  "android/app/src/test/java/com/kangsungbae/orbitslash/ExampleUnitTest.java",
  "src/platform/google-play/GooglePlayBridge.ts",
];

for (const file of requiredFiles) read(file);

const config = read("capacitor.config.ts");
assert(config.includes('appId: "com.kangsungbae.orbitslash"'), "Capacitor appId must match the Android package.");
assert(config.includes('appName: "Orbit Slash"'), "Capacitor appName must be Orbit Slash.");
assert(config.includes('webDir: "dist"'), "Capacitor webDir must be dist.");

const appBuild = read("android/app/build.gradle");
assert(appBuild.includes('namespace = "com.kangsungbae.orbitslash"'), "Android namespace is missing.");
assert(appBuild.includes('applicationId "com.kangsungbae.orbitslash"'), "Android applicationId is missing.");

const activity = read("android/app/src/main/java/com/kangsungbae/orbitslash/MainActivity.kt");
assert(activity.includes("class MainActivity"), "Android host activity is missing.");
assert(!/BillingClient|AdMob|CredentialManager/.test(activity), "MainActivity must remain a thin host, not a service SDK container.");

const instrumentedTest = read("android/app/src/androidTest/java/com/kangsungbae/orbitslash/ExampleInstrumentedTest.java");
assert(instrumentedTest.includes("package com.kangsungbae.orbitslash;"), "Android instrumentation package must match Orbit Slash.");
assert(instrumentedTest.includes('assertEquals("com.kangsungbae.orbitslash", appContext.getPackageName())'), "Android instrumentation app id is stale.");

const unitTest = read("android/app/src/test/java/com/kangsungbae/orbitslash/ExampleUnitTest.java");
const pluginSource = read("android/app/src/main/java/com/kangsungbae/orbitslash/OrbitSlashGooglePlayPlugin.kt");
assert(unitTest.includes("usesSafeUnsupportedPluginContract"), "Android unit test must cover the native plugin safe contract.");
assert(unitTest.includes("OrbitSlashGooglePlayPlugin.PLUGIN_NAME"), "Android unit test must assert the native plugin name.");
assert(!unitTest.includes("additionIsCorrect") && !unitTest.includes("2 + 2"), "Android unit test must not be a generated arithmetic placeholder.");
assert(pluginSource.includes("package com.kangsungbae.orbitslash"), "Native plugin package must match Orbit Slash.");
assert(pluginSource.includes('const val PLUGIN_NAME = "OrbitSlashGooglePlay"'), "Native plugin name contract is missing.");
assert(pluginSource.includes('const val UNSUPPORTED_REASON = "platform_not_supported"'), "Native plugin unsupported contract is missing.");

const packageJson = JSON.parse(read("package.json"));
assert(packageJson.dependencies?.["@capacitor/core"] === "8.4.1", "@capacitor/core must be pinned to 8.4.1.");
assert(packageJson.dependencies?.["@capacitor/android"] === "8.4.1", "@capacitor/android must be pinned to 8.4.1.");
assert(packageJson.devDependencies?.["@capacitor/cli"] === "8.4.1", "@capacitor/cli must be pinned to 8.4.1.");

const forbidden = /@capacitor\/|BillingClient|AdMob|CredentialManager|com\.android\.billingclient|com\.google\.android\.gms\.ads/;
for (const source of [...walk("src/game"), ...walk("src/render")]) {
  if (source.endsWith(".test.ts")) continue;
  assert(!forbidden.test(read(source)), `Google/Capacitor SDK identifier leaked into shared product code: ${source}`);
}

console.log("Google Play shell boundary ok: thin Android host + platform-only Capacitor bridge.");

function walk(relativeDirectory) {
  const directory = resolve(root, relativeDirectory);
  return readdirSync(directory).flatMap((name) => {
    const relative = `${relativeDirectory}/${name}`;
    return statSync(resolve(root, relative)).isDirectory() ? walk(relative) : [relative];
  });
}

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
