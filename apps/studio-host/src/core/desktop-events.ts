import type { CommandDispatcher } from '@/upstream/commands';
import type { EventBus } from '@/upstream/core';
import { isTauriRuntime } from '@/core/bridge-factory';
import { findLatestSupportedDocumentPath, hasSupportedDocumentPath } from '@/core/document-files';
import type { DesktopBridgeApi, DesktopLoadPayload, DesktopUpdateState } from './tauri-bridge';
import { ExternalChangeWatcher, isAutoReloadEnabled } from './external-change-watcher';
import { ExternalChangeNotice } from '../ui/external-change-notice';

type DesktopRuntimeBridge = Partial<
  Pick<
    DesktopBridgeApi,
    | 'openDocumentByPath'
    | 'takePendingOpenPaths'
    | 'createNewDocumentAsync'
    | 'confirmWindowClose'
    | 'destroyCurrentWindow'
    | 'cancelAppQuit'
    | 'hasUnsavedChanges'
    | 'getUpdateState'
    | 'pollExternalChange'
    | 'reloadFromDisk'
  >
>;

interface DesktopEventsOptions {
  bridge: unknown;
  dispatcher: CommandDispatcher;
  eventBus: EventBus;
  setMessage(message: string): void;
  onUpdateState(state: DesktopUpdateState): void;
}

interface CloseRequestEvent {
  preventDefault(): void;
}

export async function setupDesktopEvents({
  bridge,
  dispatcher,
  eventBus,
  setMessage,
  onUpdateState,
}: DesktopEventsOptions): Promise<void> {
  if (!isTauriRuntime()) return;

  const desktop = bridge as DesktopRuntimeBridge;
  const { listen } = await import('@tauri-apps/api/event');
  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const currentWindow = getCurrentWebviewWindow();

  await listen('hop-job-progress', (event) => {
    const payload = event.payload as { message?: string };
    if (payload?.message) setMessage(payload.message);
  });

  await listen('hop-update-state', (event) => {
    onUpdateState(event.payload as DesktopUpdateState);
  });

  await currentWindow.listen('hop-menu-command', (event) => {
    const command = String(event.payload || '');
    if (command) dispatcher.dispatch(command);
  });

  await currentWindow.listen('hop-app-quit-requested', async () => {
    await handleDesktopAppQuitRequest(desktop, setMessage);
  });

  await currentWindow.listen('hop-open-paths', async (event) => {
    const payload = event.payload as { paths?: string[] };
    const pending = await desktop.takePendingOpenPaths?.();
    await openLatestDesktopDocument({
      bridge: desktop,
      eventBus,
      paths: [...(payload.paths ?? []), ...(pending ?? [])],
      setMessage,
    });
  });

  await currentWindow.listen('tauri://drag-enter', (event) => {
    const payload = event.payload as { paths?: string[] };
    if (hasSupportedDocumentPath(payload.paths ?? [])) {
      setDesktopDragActive(true);
      setMessage('HWP/HWPX 파일을 놓으면 문서를 엽니다');
    }
  });

  await currentWindow.listen('tauri://drag-leave', () => {
    setDesktopDragActive(false);
  });

  await currentWindow.listen('tauri://drag-drop', () => {
    setDesktopDragActive(false);
  });

  await currentWindow.onCloseRequested(async (event) => {
    await handleDesktopCloseRequest(event, desktop, setMessage);
  });

  const pending = await desktop.takePendingOpenPaths?.();
  await openLatestDesktopDocument({
    bridge: desktop,
    eventBus,
    paths: pending ?? [],
    setMessage,
  });

  startExternalChangeWatcher(desktop, eventBus);

  if (desktop.getUpdateState) {
    try {
      onUpdateState(await desktop.getUpdateState());
    } catch (error) {
      console.warn('[desktop-events] updater state hydrate failed:', error);
    }
  }
}

export async function createDesktopDocument(bridge: unknown): Promise<DesktopLoadPayload | null> {
  const desktop = bridge as DesktopRuntimeBridge;
  if (!desktop.createNewDocumentAsync) return null;
  return desktop.createNewDocumentAsync();
}

async function handleDesktopCloseRequest(
  event: CloseRequestEvent,
  desktop: DesktopRuntimeBridge,
  setMessage: (message: string) => void,
): Promise<void> {
  if (!desktop.destroyCurrentWindow) return;
  event.preventDefault();
  await confirmAndDestroyWindow(desktop, {
    context: 'close request',
    errorPrefix: '창 닫기 실패',
    setMessage,
  });
}

async function handleDesktopAppQuitRequest(
  desktop: DesktopRuntimeBridge,
  setMessage: (message: string) => void,
): Promise<void> {
  if (!desktop.destroyCurrentWindow) return;
  await confirmAndDestroyWindow(desktop, {
    context: 'app quit request',
    errorPrefix: '앱 종료 실패',
    onCancel: () => desktop.cancelAppQuit?.(),
    setMessage,
  });
}

function setDesktopDragActive(active: boolean): void {
  document.getElementById('scroll-container')?.classList.toggle('drag-over', active);
}

async function confirmAndDestroyWindow(
  desktop: DesktopRuntimeBridge,
  {
    context,
    errorPrefix,
    onCancel,
    setMessage,
  }: {
    context: string;
    errorPrefix: string;
    onCancel?: () => Promise<void> | void;
    setMessage: (message: string) => void;
  },
): Promise<void> {
  if (!desktop.destroyCurrentWindow) return;

  try {
    const canClose = desktop.confirmWindowClose ? await desktop.confirmWindowClose() : true;
    if (canClose) {
      await desktop.destroyCurrentWindow();
    } else {
      await onCancel?.();
    }
  } catch (error) {
    console.error(`[desktop-events] ${context} failed:`, error);
    if (!desktop.hasUnsavedChanges?.()) {
      await desktop.destroyCurrentWindow();
    } else {
      setMessage(`${errorPrefix}: ${error}`);
      await onCancel?.();
    }
  }
}

async function openLatestDesktopDocument({
  bridge,
  eventBus,
  paths,
  setMessage,
}: {
  bridge: DesktopRuntimeBridge;
  eventBus: EventBus;
  paths: string[];
  setMessage(message: string): void;
}): Promise<void> {
  const path = findLatestSupportedDocumentPath(paths);
  if (!path) {
    if (paths.length > 0) setMessage('HWP/HWPX 파일만 열 수 있습니다');
    return;
  }
  if (!bridge.openDocumentByPath) return;

  try {
    setMessage('파일 로딩 중...');
    const loaded = await bridge.openDocumentByPath(path);
    if (loaded) eventBus.emit('desktop-document-loaded', loaded);
  } catch (error) {
    const errMsg = `파일 로드 실패: ${error}`;
    setMessage(errMsg);
    console.error('[desktop-events] 데스크톱 파일 로드 실패:', error);
  }
}

// 에이전트 등이 열린 파일을 바꾸면 화면에 반영한다(localStorage kdoc.autoReload=off 로 끈다).
function startExternalChangeWatcher(bridge: DesktopRuntimeBridge, eventBus: EventBus): void {
  const { pollExternalChange, reloadFromDisk, hasUnsavedChanges } = bridge;
  if (!pollExternalChange || !reloadFromDisk || !hasUnsavedChanges) return;
  if (!isAutoReloadEnabled(globalThis.localStorage)) return;

  const watcher = new ExternalChangeWatcher(
    {
      pollExternalChange: () => pollExternalChange.call(bridge),
      hasUnsavedChanges: () => hasUnsavedChanges.call(bridge),
      reloadFromDisk: async (options) => {
        const scroll = currentScrollPosition();
        const loaded = await reloadFromDisk.call(bridge, options);
        if (!loaded) return false;
        eventBus.emit('desktop-document-loaded', {
          ...loaded,
          message: `바뀐 내용을 불러왔어요 — ${loaded.message}`,
          scroll,
        });
        return true;
      },
    },
    new ExternalChangeNotice(),
  );
  watcher.start();
}

function currentScrollPosition(): { top: number; left: number } | undefined {
  const container = document.getElementById('scroll-container');
  return container ? { top: container.scrollTop, left: container.scrollLeft } : undefined;
}
