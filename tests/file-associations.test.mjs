import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// macOS 는 .hwp/.hwpx 확장자를 설치된 앱들이 선언한 형식 이름(UTI) 중 하나로 정한다.
// 그 이름이 K-Doc 목록에 없으면 「다음으로 열기」·기본 앱 목록과 Quick Look 에서 K-Doc 이 빠진다.
// 예: LibreOffice 가 깔린 맥에서 .hwp 는 org.libreoffice.hwp-document 로 잡힌다.
const HWP_TYPES = [
  'io.github.zoo3323.k-doc.hwp',
  'com.hancom.hwp',
  'com.haansoft.hancomofficeviewer.mac.hwp',
  'org.libreoffice.hwp-document',
  'com.postmelee.alhangeul.hwp',
  'net.golbin.hop.hwp',
];
const HWPX_TYPES = [
  'io.github.zoo3323.k-doc.hwpx',
  'com.hancom.hwpx',
  'com.haansoft.hancomofficeviewer.mac.hwpx',
  'com.postmelee.alhangeul.hwpx',
  'net.golbin.hop.hwpx',
];

test('문서 연결이 다른 앱이 선언한 HWP·HWPX 형식 이름도 모두 받는다', async () => {
  const tauriConfig = JSON.parse(await readFile(join(repoRoot, 'apps/desktop/src-tauri/tauri.conf.json'), 'utf8'));
  const byExt = Object.fromEntries(tauriConfig.bundle.fileAssociations.map((fa) => [fa.ext.join(','), fa.contentTypes]));
  for (const type of HWP_TYPES) assert.ok(byExt.hwp.includes(type), `hwp 연결에 ${type} 가 없다`);
  for (const type of HWPX_TYPES) assert.ok(byExt.hwpx.includes(type), `hwpx 연결에 ${type} 가 없다`);
});

test('Quick Look 미리보기·썸네일이 같은 형식 이름을 모두 받는다', async () => {
  for (const kind of ['Preview', 'Thumbnail']) {
    const plist = await readFile(join(repoRoot, `apps/desktop/quicklook/Resources/${kind}/Info.plist`), 'utf8');
    for (const type of [...HWP_TYPES, ...HWPX_TYPES]) {
      assert.ok(plist.includes(`<string>${type}</string>`), `${kind} Quick Look 에 ${type} 가 없다`);
    }
  }
});
