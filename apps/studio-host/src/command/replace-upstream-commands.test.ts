import { describe, expect, it, vi } from 'vitest';
import studioHtml from '../../index.html?raw';
import type { CommandDef } from '@/upstream/commands';
import {
  insertCommands,
  formatCommands,
  pageCommands,
  tableCommands,
  toolCommands,
  viewCommands,
} from '@/upstream/commands';
import { toolbarLabelsCommand } from '../host/toolbar-labels';
import { editCommands } from './commands/edit';
import { fileCommands } from './commands/file';
import { hancomCommands } from './commands/hancom';
import { assertUniqueCommandIds, replaceUpstreamCommands } from './replace-upstream-commands';
import { defaultShortcuts } from './shortcut-map';

const command = (id: string): CommandDef => ({ id, label: id, execute: vi.fn() });
const productionCommandGroups = [
  fileCommands,
  editCommands,
  [...viewCommands, toolbarLabelsCommand],
  formatCommands,
  insertCommands,
  tableCommands,
  pageCommands,
  toolCommands,
  hancomCommands,
] as const;
const productionCommandIds = new Set(productionCommandGroups.flat().map(({ id }) => id));

describe('replaceUpstreamCommands', () => {
  it('preserves upstream order while replacing selected commands', () => {
    const replacement = command('edit:paste');
    expect(replaceUpstreamCommands(
      [command('edit:copy'), command('edit:paste')],
      [replacement],
    )).toEqual([expect.objectContaining({ id: 'edit:copy' }), replacement]);
  });

  it('rejects an override whose upstream target disappeared', () => {
    expect(() => replaceUpstreamCommands(
      [command('edit:copy')],
      [command('edit:paste')],
    )).toThrow(/edit:paste/);
  });

  it('rejects duplicate HOP override targets', () => {
    expect(() => replaceUpstreamCommands(
      [command('edit:paste')],
      [command('edit:paste'), command('edit:paste')],
    )).toThrow(/Duplicate/);
  });

  it('rejects duplicate command IDs across contribution groups', () => {
    expect(() => assertUniqueCommandIds([
      [command('file:save')],
      [command('file:save')],
    ])).toThrow(/file:save/);
  });

  it('keeps the production command contribution graph free of duplicate IDs', () => {
    expect(() => assertUniqueCommandIds(productionCommandGroups)).not.toThrow();
  });

  it('registers every command referenced by the studio HTML', () => {
    const missing = Array.from(studioHtml.matchAll(/<[^>]*\bdata-cmd="([^"]+)"[^>]*>/g))
      .map(([, id]) => id)
      .filter((id) => !productionCommandIds.has(id));

    expect([...new Set(missing)]).toEqual([]);
  });

  // 한글 기본 기능은 엔진·명령이 있어도 메뉴에 없으면 사람이 못 쓴다(2단계 편집 빈칸).
  it('exposes the Hancom basics that the engine already supports', () => {
    const exposed = new Set(Array.from(studioHtml.matchAll(/\bdata-cmd="([^"]+)"/g), ([, id]) => id));
    const hancomBasics = [
      'edit:format-copy',
      'edit:format-paste',
      'view:zoom-dialog',
      'view:toggle-grid',
      'insert:equation',
      'insert:endnote',
      'insert:endnote-shape',
      'insert:note-close',
      'page:page-border',
      'page:insert-field-pagenum',
      'table:transpose-copy',
      'table:transpose-paste',
    ];

    expect(hancomBasics.filter((id) => !exposed.has(id))).toEqual([]);
  });

  // 메뉴에 보이는 항목은 어떤 상황에서든 실행될 수 있어야 한다(이름만 있는 껍데기 금지).
  // 남은 껍데기는 아래 목록으로만 허용하고 줄여 간다.
  it('backs every menu item with a command that can run somewhere', () => {
    // 상황 플래그를 하나·둘씩 켜 본다. 어느 상황에서도 꺼져 있으면 껍데기다.
    const canRunSomewhere = (canExecute: NonNullable<CommandDef['canExecute']>) => {
      const seen = new Set<string>(['hasDocument']);
      const ctxWith = (on: Set<string>) =>
        new Proxy({}, { get: (_t, key) => { seen.add(String(key)); return on.has(String(key)); } }) as never;
      for (let round = 0; round < 3; round += 1) {
        const keys = [...seen];
        const tries: Set<string>[] = [new Set(keys), new Set(['hasDocument'])];
        for (const a of keys) {
          tries.push(new Set(['hasDocument', a]));
          for (const b of keys) tries.push(new Set(['hasDocument', a, b]));
        }
        if (tries.some((on) => canExecute(ctxWith(on)))) return true;
      }
      return false;
    };
    // 메모(주석) 넣기는 엔진에 메모 넣기·그리기가 아직 없다.
    const knownShells = new Set(['insert:comment']);
    const byId = new Map(productionCommandGroups.flat().map((def) => [def.id, def]));
    const menuIds = new Set(Array.from(studioHtml.matchAll(/\bdata-cmd="([^"]+)"/g), ([, id]) => id));
    const shells = [...menuIds].filter((id) => {
      const def = byId.get(id);
      return def?.canExecute ? !canRunSomewhere(def.canExecute) : false;
    });

    expect(shells.filter((id) => !knownShells.has(id))).toEqual([]);
  });

  it('keeps production shortcuts unique and backed by registered commands', () => {
    const shortcutKeys = defaultShortcuts.map(([shortcut]) => [
      shortcut.key.toLowerCase(),
      shortcut.code?.toLowerCase() ?? '',
      shortcut.ctrl ? 'ctrl' : '',
      shortcut.shift ? 'shift' : '',
      shortcut.alt ? 'alt' : '',
      shortcut.platform ?? '',
    ].join(':'));
    const missing = defaultShortcuts
      .map(([, id]) => id)
      .filter((id) => !productionCommandIds.has(id));

    expect(new Set(shortcutKeys).size).toBe(shortcutKeys.length);
    expect([...new Set(missing)]).toEqual([]);
  });
});
