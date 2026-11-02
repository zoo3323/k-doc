import type { ExternalChangeView } from '../core/external-change-watcher';

// 업데이트 알림과 같은 모양(update-notice 스타일)을 쓴다.
export class ExternalChangeNotice implements ExternalChangeView {
  private readonly root: HTMLDivElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly bodyEl: HTMLParagraphElement;
  private readonly actionsEl: HTMLDivElement;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'update-notice external-change-notice';
    this.root.hidden = true;
    this.root.setAttribute('role', 'alert');

    this.titleEl = document.createElement('h2');
    this.titleEl.className = 'update-notice__title';
    this.bodyEl = document.createElement('p');
    this.bodyEl.className = 'update-notice__body';
    this.actionsEl = document.createElement('div');
    this.actionsEl.className = 'update-notice__actions';

    this.root.append(this.titleEl, this.bodyEl, this.actionsEl);
    document.body.appendChild(this.root);
  }

  showModified(actions: { reload(): void; keep(): void }): void {
    this.show(
      '다른 프로그램이 이 파일을 바꿨어요',
      '고치던 내용이 있어 자동으로 불러오지 않았어요.',
      [
        this.button('다시 불러오기', true, actions.reload),
        this.button('내 것 유지', false, actions.keep),
      ],
    );
  }

  showMissing(dismiss: () => void): void {
    this.show(
      '원본 파일이 지워졌거나 옮겨졌어요',
      '저장하면 같은 자리에 새로 만들어요.',
      [this.button('닫기', false, dismiss)],
    );
  }

  hide(): void {
    this.root.hidden = true;
  }

  private show(title: string, body: string, buttons: HTMLButtonElement[]): void {
    this.titleEl.textContent = title;
    this.bodyEl.textContent = body;
    this.actionsEl.replaceChildren(...buttons);
    this.root.hidden = false;
  }

  private button(label: string, primary: boolean, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `update-notice__button${primary ? ' update-notice__button--primary' : ''}`;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }
}
