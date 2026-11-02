import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFile(join(repoRoot, path), 'utf8');

// 에이전트가 보는 배치 = 사람이 K-Doc 에서 보는 배치(docs/operations/agent-parity-1pager.md).
test('앱이 화면 엔진과 같은 트리로 빌드한 에이전트 도구를 함께 싣는다', async () => {
  const tauriConfig = JSON.parse(await read('apps/desktop/src-tauri/tauri.conf.json'));
  assert.deepEqual(tauriConfig.bundle.externalBin, ['binaries/k-doc-agent']);

  const release = await read('.github/workflows/release.yml');
  assert.match(release, /scripts\/build-agent-cli\.sh "\$\{\{ matrix\.target \}\}"/);

  const build = await read('scripts/build-agent-cli.sh');
  assert.match(build, /scripts\/prepare-rhwp\.sh/);
  assert.match(build, /k-doc-agent-\$TARGET/);
});

test('CI 가 에이전트 도구와 화면 엔진의 쪽 렌더가 같은지 검사한다', async () => {
  const check = await read('.github/workflows/check.yml');
  assert.match(check, /node scripts\/agent-parity\.mjs/);
  assert.match(check, /two_column_exam_floats/);
});
