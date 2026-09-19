#!/usr/bin/env node
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const assetRoot = join(root, "public", "assets");
const MAX_BOOT_BYTES = 700 * 1024;
const MAX_SINGLE_ASSET_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 12 * 1024 * 1024;
const MAX_EAGER_AUDIO_BYTES = 2 * 1024 * 1024;
const AUDIO_ASSET_PATTERN = /\.(m4a|ogg|mp3|wav|aac)$/i;
const bootPaths = [join(assetRoot, "earth", "earth-core.png"), join(assetRoot, "earth", "earth-shield.png")];
const files = listAssets(assetRoot);
const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
const bootBytes = bootPaths.reduce((sum, file) => sum + statSync(file).size, 0);
const eagerAudioBytes = files
  .filter((file) => AUDIO_ASSET_PATTERN.test(file))
  .reduce((sum, file) => sum + statSync(file).size, 0);
const oversized = files.filter((file) => statSync(file).size > MAX_SINGLE_ASSET_BYTES);

if (
  bootBytes > MAX_BOOT_BYTES
  || eagerAudioBytes > MAX_EAGER_AUDIO_BYTES
  || totalBytes > MAX_TOTAL_ASSET_BYTES
  || oversized.length > 0
) {
  console.error(JSON.stringify({
    ok: false,
    bootBytes,
    maxBootBytes: MAX_BOOT_BYTES,
    eagerAudioBytes,
    maxEagerAudioBytes: MAX_EAGER_AUDIO_BYTES,
    totalBytes,
    maxTotalBytes: MAX_TOTAL_ASSET_BYTES,
    oversized: oversized.map((file) => ({ path: relative(root, file), bytes: statSync(file).size, maxBytes: MAX_SINGLE_ASSET_BYTES })),
  }, null, 2));
  process.exit(1);
}

console.log(
  `asset budget ok: boot=${bootBytes}B total=${totalBytes}B eagerAudio=${eagerAudioBytes}B/${MAX_EAGER_AUDIO_BYTES}B files=${files.length}`,
);

function listAssets(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listAssets(path);
    return /\.(png|webp|jpg|jpeg|svg|avif|m4a|ogg|mp3|wav|aac)$/i.test(entry.name) ? [path] : [];
  });
}
