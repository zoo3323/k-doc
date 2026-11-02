import { describe, expect, it, vi } from 'vitest';
import {
  ExternalChangeWatcher,
  isAutoReloadEnabled,
  type ExternalChangeHost,
  type ExternalChangePoll,
  type ExternalChangeView,
} from './external-change-watcher';

function setup(polls: Array<ExternalChangePoll | null>, dirty = false) {
  const queue = [...polls];
  const host: ExternalChangeHost & { dirty: boolean } = {
    dirty,
    pollExternalChange: vi.fn(async (): Promise<ExternalChangePoll | null> => queue.shift() ?? { state: 'unchanged' }),
    hasUnsavedChanges: vi.fn(() => host.dirty),
    reloadFromDisk: vi.fn(async () => true),
  };
  const view: ExternalChangeView & { actions?: { reload(): void; keep(): void } } = {
    showModified: vi.fn((actions) => {
      view.actions = actions;
    }),
    showMissing: vi.fn(),
    hide: vi.fn(),
  };
  const onReloaded = vi.fn();
  const watcher = new ExternalChangeWatcher(host, view, onReloaded);
  return { host, view, onReloaded, watcher };
}

const modified = (token: string): ExternalChangePoll => ({ state: 'modified', token });

describe('ExternalChangeWatcher', () => {
  it('고친 내용이 없으면 파일이 멈춘 뒤 조용히 다시 불러온다', async () => {
    const { host, onReloaded, watcher } = setup([modified('a'), modified('a')]);

    await watcher.tick();
    expect(host.reloadFromDisk).not.toHaveBeenCalled();

    await watcher.tick();
    expect(host.reloadFromDisk).toHaveBeenCalledWith({ discardChanges: false });
    expect(onReloaded).toHaveBeenCalledWith(true);
  });

  it('쓰는 중이라 표시가 계속 바뀌면 기다린다', async () => {
    const { host, watcher } = setup([modified('a'), modified('b'), modified('c')]);
    await watcher.tick();
    await watcher.tick();
    await watcher.tick();
    expect(host.reloadFromDisk).not.toHaveBeenCalled();
  });

  it('고친 내용이 있으면 덮어쓰지 않고 알린다', async () => {
    const { host, view, watcher } = setup([modified('a'), modified('a')], true);
    await watcher.tick();
    await watcher.tick();
    expect(host.reloadFromDisk).not.toHaveBeenCalled();
    expect(view.showModified).toHaveBeenCalledTimes(1);
  });

  it('알림에서 다시 불러오기를 고르면 내 수정을 버리고 불러온다', async () => {
    const { host, view, onReloaded, watcher } = setup([modified('a'), modified('a')], true);
    await watcher.tick();
    await watcher.tick();
    view.actions?.reload();
    await vi.waitFor(() => expect(onReloaded).toHaveBeenCalledWith(false));
    expect(host.reloadFromDisk).toHaveBeenCalledWith({ discardChanges: true });
  });

  it('내 것 유지를 고르면 같은 변경은 다시 알리지 않고 새 변경은 알린다', async () => {
    const { view, watcher } = setup(
      [modified('a'), modified('a'), modified('a'), modified('b'), modified('b')],
      true,
    );
    await watcher.tick();
    await watcher.tick();
    view.actions?.keep();
    await watcher.tick();
    expect(view.showModified).toHaveBeenCalledTimes(1);

    await watcher.tick();
    await watcher.tick();
    expect(view.showModified).toHaveBeenCalledTimes(2);
  });

  it('원본이 없어지면 알린다', async () => {
    const { host, view, watcher } = setup([{ state: 'missing', token: 'missing' }]);
    await watcher.tick();
    expect(view.showMissing).toHaveBeenCalledTimes(1);
    expect(host.reloadFromDisk).not.toHaveBeenCalled();
  });

  it('파일이 원래대로면 알림을 닫는다', async () => {
    const { view, watcher } = setup([{ state: 'unchanged' }]);
    await watcher.tick();
    expect(view.hide).toHaveBeenCalled();
  });

  it('설정으로 끌 수 있다', () => {
    expect(isAutoReloadEnabled({ getItem: () => null })).toBe(true);
    expect(isAutoReloadEnabled({ getItem: () => 'off' })).toBe(false);
  });
});
