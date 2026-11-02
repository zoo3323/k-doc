#!/usr/bin/env node
// 에이전트 도구(MCP)가 그린 쪽과 K-Doc 화면 엔진(WASM)이 그린 쪽이 바이트까지 같은지 본다.
//
//   node scripts/agent-parity.mjs --agent <k-doc-agent 경로> <문서...>
//
// 에이전트 쪽은 `k-doc-agent mcp-serve` 에 hwp_open → hwp_doc_render_page 로 묻는다(에이전트가 실제로 쓰는 길).
// 화면 쪽은 apps/studio-host/vendor/rhwp-core 의 WASM 으로 new HwpDocument(bytes).renderPageSvg(page).
// K-Doc 화면은 portable 치수만 쓰므로(patches/rhwp/0011) 두 결과가 같아야 한다.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function parseArgs(argv) {
  const agentIndex = argv.indexOf('--agent');
  if (agentIndex < 0 || !argv[agentIndex + 1]) throw new Error('--agent <경로> 가 필요합니다');
  const agent = resolve(argv[agentIndex + 1]);
  const documents = argv.filter((_, i) => i !== agentIndex && i !== agentIndex + 1).map((p) => resolve(p));
  if (documents.length === 0) throw new Error('비교할 문서를 하나 이상 주세요');
  return { agent, documents };
}

async function loadEngine() {
  const vendor = join(root, 'apps/studio-host/vendor/rhwp-core');
  const engine = await import(pathToFileURL(join(vendor, 'rhwp.js')).href);
  await engine.default({ module_or_path: readFileSync(join(vendor, 'rhwp_bg.wasm')) });
  return engine;
}

class McpClient {
  constructor(command) {
    this.child = spawn(command, ['mcp-serve'], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.pending = new Map();
    this.nextId = 1;
    createInterface({ input: this.child.stdout }).on('line', (line) => {
      if (!line.trim()) return;
      const message = JSON.parse(line);
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    });
  }

  request(method, params) {
    const id = this.nextId++;
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    return new Promise((resolvePromise, reject) => this.pending.set(id, { resolve: resolvePromise, reject }));
  }

  async callTool(name, args) {
    const result = await this.request('tools/call', { name, arguments: args });
    const text = result?.content?.map((part) => part.text ?? '').join('') ?? '';
    if (result?.isError) throw new Error(`${name} 실패: ${text}`);
    return text ? JSON.parse(text) : {};
  }

  close() {
    this.child.stdin.end();
    this.child.kill();
  }
}

function findDocId(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.docId === 'string') return value.docId;
  for (const child of Object.values(value)) {
    const found = findDocId(child);
    if (found) return found;
  }
  return null;
}

async function compareDocument(engine, agent, path, workDir) {
  const doc = new engine.HwpDocument(readFileSync(path));
  const pageCount = doc.pageCount();
  const opened = await agent.callTool('hwp_open', { path });
  const docId = findDocId(opened);
  if (!docId) throw new Error(`hwp_open 응답에 docId 가 없습니다: ${JSON.stringify(opened).slice(0, 200)}`);

  const mismatches = [];
  for (let page = 0; page < pageCount; page += 1) {
    const output = join(workDir, `page-${page}.svg`);
    await agent.callTool('hwp_doc_render_page', { docId, page, output });
    const agentSvg = readFileSync(output, 'utf8');
    const screenSvg = doc.renderPageSvg(page);
    if (agentSvg !== screenSvg) mismatches.push({ page, agentBytes: agentSvg.length, screenBytes: screenSvg.length });
  }
  doc.free?.();
  return { path, pageCount, mismatches };
}

async function main() {
  const { agent: agentPath, documents } = parseArgs(process.argv.slice(2));
  const engine = await loadEngine();
  const agent = new McpClient(agentPath);
  const workDir = mkdtempSync(join(tmpdir(), 'kdoc-parity-'));
  let failed = false;
  try {
    await agent.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'k-doc-agent-parity', version: '1' },
    });
    for (const path of documents) {
      const result = await compareDocument(engine, agent, path, workDir);
      const status = result.mismatches.length === 0 ? '같음' : `다름 ${result.mismatches.length}쪽`;
      console.log(`${status}\t${result.pageCount}쪽\t${path}`);
      for (const mismatch of result.mismatches) {
        console.log(`  ${mismatch.page + 1}쪽: 에이전트 ${mismatch.agentBytes}B / 화면 ${mismatch.screenBytes}B`);
      }
      failed ||= result.mismatches.length > 0;
    }
  } finally {
    agent.close();
    rmSync(workDir, { recursive: true, force: true });
  }
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
