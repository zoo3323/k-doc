// 에이전트 등 다른 프로그램이 열린 문서 파일을 바꾸면 K-Doc 화면에 반영한다.
// - 고친 내용이 없으면 조용히 다시 불러온다.
// - 고친 내용이 있으면 덮어쓰지 않고 알린다.
// 쓰는 도중의 파일을 읽지 않도록 같은 표시(token)가 두 번 연달아 나올 때만 움직인다.

export type ExternalChangeState = 'unchanged' | 'modified' | 'missing';

export interface ExternalChangePoll {
  state: ExternalChangeState;
  token?: string | null;
}

export interface ExternalChangeHost {
  pollExternalChange(): Promise<ExternalChangePoll | null>;
  hasUnsavedChanges(): boolean;
  reloadFromDisk(options: { discardChanges: boolean }): Promise<boolean>;
}

export interface ExternalChangeView {
  showModified(actions: { reload(): void; keep(): void }): void;
  showMissing(dismiss: () => void): void;
  hide(): void;
}

export const AUTO_RELOAD_STORAGE_KEY = 'kdoc.autoReload';
const POLL_INTERVAL_MS = 1000;

export class ExternalChangeWatcher {
  private pendingToken: string | null = null;
  private dismissedToken: string | null = null;
  private busy = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly host: ExternalChangeHost,
    private readonly view: ExternalChangeView,
    private readonly onReloaded: (silent: boolean) => void = () => undefined,
  ) {}

  start(intervalMs = POLL_INTERVAL_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const poll = await this.host.pollExternalChange();
      await this.handle(poll);
    } catch (error) {
      console.warn('[external-change] 파일 상태 확인 실패:', error);
    } finally {
      this.busy = false;
    }
  }

  private async handle(poll: ExternalChangePoll | null): Promise<void> {
    if (!poll || poll.state === 'unchanged') {
      this.pendingToken = null;
      this.dismissedToken = null;
      this.view.hide();
      return;
    }

    const token = poll.token ?? poll.state;
    if (token === this.dismissedToken) return;

    if (poll.state === 'missing') {
      this.view.showMissing(() => this.dismiss(token));
      return;
    }

    // 쓰기가 끝나 파일이 멈췄는지 한 번 더 본다.
    if (token !== this.pendingToken) {
      this.pendingToken = token;
      return;
    }
    this.pendingToken = null;

    if (!this.host.hasUnsavedChanges()) {
      if (await this.host.reloadFromDisk({ discardChanges: false })) this.onReloaded(true);
      return;
    }

    this.view.showModified({
      reload: () => void this.reloadDiscarding(),
      keep: () => this.dismiss(token),
    });
  }

  private async reloadDiscarding(): Promise<void> {
    this.view.hide();
    try {
      if (await this.host.reloadFromDisk({ discardChanges: true })) this.onReloaded(false);
    } catch (error) {
      console.warn('[external-change] 다시 불러오기 실패:', error);
    }
  }

  private dismiss(token: string): void {
    this.dismissedToken = token;
    this.view.hide();
  }
}

export function isAutoReloadEnabled(storage: Pick<Storage, 'getItem'> | undefined): boolean {
  try {
    return storage?.getItem(AUTO_RELOAD_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}
