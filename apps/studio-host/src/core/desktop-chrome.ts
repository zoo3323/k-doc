import { normalizeShortcutLabel, type DesktopPlatform } from './platform';

const NON_EDITOR_CHROME_SELECTOR = '#menu-bar, #icon-toolbar, #style-bar, #status-bar';
const SHORTCUT_TEXT_SELECTOR = '.md-shortcut, .tb-split-shortcut';

export function applyDesktopChromePlatformState(
  doc: Document,
  platform: DesktopPlatform,
): void {
  if (platform === 'macos') {
    normalizeShortcutPresentation(doc, platform);
  }
}

export function installNonEditorContextMenuGuards(doc: Document): void {
  const preventContextMenu = (event: Event) => {
    event.preventDefault();
  };

  doc.querySelectorAll<HTMLElement>(NON_EDITOR_CHROME_SELECTOR).forEach((element) => {
    element.addEventListener('contextmenu', preventContextMenu);
  });
}

function normalizeShortcutPresentation(doc: Document, platform: DesktopPlatform): void {
  doc.querySelectorAll<HTMLElement>(SHORTCUT_TEXT_SELECTOR).forEach((element) => {
    const text = element.textContent;
    if (!text) return;
    element.textContent = normalizeShortcutLabel(text, platform);
  });

  doc.querySelectorAll<HTMLElement>('[title]').forEach((element) => {
    const title = element.getAttribute('title');
    if (!title) return;
    const normalized = normalizeDesktopChromeTitle(title, platform);
    if (normalized !== title) {
      element.setAttribute('title', normalized);
    }
  });
}

export function normalizeDesktopChromeTitle(
  title: string,
  platform: DesktopPlatform,
): string {
  if (!hasShortcutTokens(title)) return title;
  return normalizeShortcutLabel(title, platform);
}

function hasShortcutTokens(label: string): boolean {
  return /\b(CmdOrCtrl|Cmd|Ctrl|Alt|Option|Shift|Num)\b/i.test(label);
}

/**
 * 데스크톱 웹뷰는 `window.open` 으로 새 창을 만들지 않아, 문서 하이퍼링크가 "팝업이
 * 차단되었습니다"로 끝난다(HOP #111). rhwp-studio 는 `window.open('about:blank')` 뒤
 * `location.replace(url)` 로 주소를 넘기므로, 그 주소를 받아 기본 브라우저로 연다.
 */
export function installExternalLinkOpener(win: Window, openExternal: (url: string) => Promise<void>): void {
  const forward = (href: unknown) => {
    const url = String(href ?? '');
    if (!url || url === 'about:blank') return;
    void openExternal(url).catch((error) => console.error('[desktop-chrome] 외부 링크 열기 실패:', error));
  };
  win.open = ((url?: string | URL) => {
    forward(url);
    const location = {
      replace: forward,
      assign: forward,
      get href() { return 'about:blank'; },
      set href(value: string) { forward(value); },
    };
    return { opener: null, closed: false, close() {}, focus() {}, location } as unknown as Window;
  }) as typeof win.open;
}
