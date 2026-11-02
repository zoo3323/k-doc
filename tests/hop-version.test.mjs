import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  cargoLockPackageVersion,
  parsePackageVersion,
} from '../scripts/lib/rhwp-upstream.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test('HOP base version stays aligned across package, native, and Quick Look metadata; K-Doc app version is semver', async () => {
  const rootPackage = await readJson('package.json');
  const desktopPackage = await readJson('apps/desktop/package.json');
  const tauriConfig = await readJson('apps/desktop/src-tauri/tauri.conf.json');
  const cargoToml = await readText('apps/desktop/src-tauri/Cargo.toml');
  const cargoLock = await readText('apps/desktop/src-tauri/Cargo.lock');
  const previewPlist = await readText('apps/desktop/quicklook/Resources/Preview/Info.plist');
  const thumbnailPlist = await readText('apps/desktop/quicklook/Resources/Thumbnail/Info.plist');
  const expectedVersion = rootPackage.version;

  assert.match(expectedVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(desktopPackage.version, expectedVersion);
  // K-Doc 은 앱 버전(0.2.x)을 tauri.conf.json 에서만 따로 올린다(릴리스 태그 v*). 나머지는 HOP 기준 버전에 둔다.
  assert.match(tauriConfig.version, /^\d+\.\d+\.\d+$/);
  assert.equal(parsePackageVersion(cargoToml), expectedVersion);
  assert.equal(cargoLockPackageVersion(cargoLock, 'hop-desktop'), expectedVersion);
  assert.equal(bundleShortVersion(previewPlist), expectedVersion);
  assert.equal(bundleShortVersion(thumbnailPlist), expectedVersion);
});

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function readText(path) {
  return readFile(join(repoRoot, path), 'utf8');
}

function bundleShortVersion(plist) {
  const version = plist.match(
    /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
  )?.[1];
  assert.ok(version, 'Quick Look Info.plist must define CFBundleShortVersionString');
  return version;
}
