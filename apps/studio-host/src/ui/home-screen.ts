import type { DesktopBridgeApi, RecentDocument } from '@/core/tauri-bridge';
import { parsePreviewSvg } from '@/ui/preview-svg';

type HomeScreenBridge = Partial<Pick<
  DesktopBridgeApi,
  'listRecentDocuments' | 'openDocumentByPath' | 'renderDocumentPreview'
>>;
const RECENT_DOCUMENTS_PER_PAGE = 5;

// 시작 화면 아이콘: 24px 격자, 1.75 선 굵기로 직접 그린 것.
const HOME_ICONS = {
  open: '<path d="M3.5 7.5V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5V9.5A1.5 1.5 0 0 0 19 8h-7l-2-2.5H5A1.5 1.5 0 0 0 3.5 7Z"/><path d="M12 11v5.5M9.5 13.5 12 11l2.5 2.5"/>',
  create: '<path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8Z"/><path d="M14 3.5V8h4.5M12 11.5v6M9 14.5h6"/>',
  drop: '<path d="M12 4v10.5M8 10.5l4 4 4-4"/><path d="M4.5 14.5v3A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-3"/>',
} as const;

function homeIcon(name: keyof typeof HOME_ICONS): HTMLElement {
  const icon = document.createElement('span');
  icon.className = `home-icon home-icon-${name}`;
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${HOME_ICONS[name]}</svg>`;
  return icon;
}

interface HomeScreenActions {
  openFile(): void;
  createNewDocument(): void;
  onDocumentLoaded(payload: unknown): void;
  setMessage(message: string): void;
}

export class HomeScreen {
  private root: HTMLElement;
  private recentSection: HTMLElement;
  private recentTrack: HTMLElement;
  private recentHint: HTMLElement;
  private recentPagination: HTMLElement;
  private recentPageLabel: HTMLElement;
  private prevButton: HTMLButtonElement;
  private nextButton: HTMLButtonElement;
  private readonly bridge: HomeScreenBridge;
  private currentPage = 0;
  private recentDocuments: RecentDocument[] = [];

  constructor(
    private container: HTMLElement,
    bridge: unknown,
    private actions: HomeScreenActions,
  ) {
    this.bridge = (bridge && typeof bridge === 'object') ? bridge as HomeScreenBridge : {};
    this.root = this.build();
    this.recentSection = this.root.querySelector('.home-recent') as HTMLElement;
    this.recentTrack = this.root.querySelector('.home-recent-track') as HTMLElement;
    this.recentHint = this.root.querySelector('.home-recent-hint') as HTMLElement;
    this.recentPagination = this.root.querySelector('.home-recent-pagination') as HTMLElement;
    this.recentPageLabel = this.root.querySelector('.home-recent-page-label') as HTMLElement;
    this.prevButton = this.root.querySelector('.home-recent-page-prev') as HTMLButtonElement;
    this.nextButton = this.root.querySelector('.home-recent-page-next') as HTMLButtonElement;
    this.container.appendChild(this.root);
  }

  async refresh(hasDocument: boolean): Promise<void> {
    this.root.hidden = hasDocument;
    this.container.classList.toggle('home-visible', !hasDocument);
    if (hasDocument) return;

    const recentDocuments = await this.loadRecentDocuments();
    this.renderRecentDocuments(recentDocuments);
  }

  private build(): HTMLElement {
    const root = document.createElement('section');
    root.className = 'home-screen';
    root.hidden = true;
    root.append(this.createHero(), this.createDropHint(), this.createRecentSection());
    return root;
  }

  private createHero(): HTMLElement {
    const hero = document.createElement('div');
    hero.className = 'home-hero';
    const brand = document.createElement('div');
    brand.className = 'home-brand';
    const logo = document.createElement('img');
    logo.className = 'home-logo';
    logo.src = '/app-logo.svg';
    logo.alt = '';
    const brandText = document.createElement('div');
    const title = document.createElement('h1');
    title.className = 'home-title';
    title.textContent = 'K-Doc';
    const subtitle = document.createElement('p');
    subtitle.className = 'home-subtitle';
    subtitle.textContent = 'HWP·HWPX 문서를 무료로 열고, 고치고, 저장하세요.';
    brandText.append(title, subtitle);
    brand.append(logo, brandText);
    const actions = document.createElement('div');
    actions.className = 'home-actions';
    const openButton = this.createActionButton('open', '문서 열기', 'HWP·HWPX 파일 고르기', () => {
      this.actions.openFile();
    });
    openButton.classList.add('is-primary');
    actions.append(
      openButton,
      this.createActionButton('create', '새 문서', '빈 문서로 바로 시작', () => {
        this.actions.createNewDocument();
      }),
    );
    hero.append(brand, actions);
    return hero;
  }

  private createRecentSection(): HTMLElement {
    const recentSection = document.createElement('section');
    recentSection.className = 'home-recent';
    const recentHeader = document.createElement('div');
    recentHeader.className = 'home-section-header';
    const recentTitle = document.createElement('h2');
    recentTitle.className = 'home-section-title';
    recentTitle.textContent = '최근 문서';
    const recentPagination = document.createElement('div');
    recentPagination.className = 'home-recent-pagination';
    const prevButton = document.createElement('button');
    prevButton.type = 'button';
    prevButton.className = 'home-recent-page-btn home-recent-page-prev';
    prevButton.textContent = '이전';
    prevButton.addEventListener('click', () => {
      this.changePage(-1);
    });
    const pageLabel = document.createElement('span');
    pageLabel.className = 'home-recent-page-label';
    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'home-recent-page-btn home-recent-page-next';
    nextButton.textContent = '다음';
    nextButton.addEventListener('click', () => {
      this.changePage(1);
    });
    recentPagination.append(prevButton, pageLabel, nextButton);
    const recentHint = document.createElement('p');
    recentHint.className = 'home-recent-hint';
    const recentTrack = document.createElement('div');
    recentTrack.className = 'home-recent-track';
    recentHeader.append(recentTitle, recentPagination);
    recentSection.append(recentHeader, recentHint, recentTrack);
    return recentSection;
  }

  private createDropHint(): HTMLElement {
    const dropHint = document.createElement('div');
    dropHint.className = 'home-drop-hint';
    const text = document.createElement('span');
    text.textContent = '파일을 이 창으로 끌어다 놓아도 열려요';
    dropHint.append(homeIcon('drop'), text);
    return dropHint;
  }

  private createActionButton(
    icon: keyof typeof HOME_ICONS,
    label: string,
    description: string,
    action: () => void,
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'home-action';
    const text = document.createElement('span');
    text.className = 'home-action-text';
    const title = document.createElement('span');
    title.className = 'home-action-title';
    title.textContent = label;
    const subtitle = document.createElement('span');
    subtitle.className = 'home-action-description';
    subtitle.textContent = description;
    text.append(title, subtitle);
    button.append(homeIcon(icon), text);
    button.addEventListener('click', action);
    return button;
  }

  private async loadRecentDocuments(): Promise<RecentDocument[]> {
    if (!this.bridge.listRecentDocuments) return [];
    try {
      return await this.bridge.listRecentDocuments();
    } catch (error) {
      console.warn('[home-screen] recent document load failed:', error);
      return [];
    }
  }

  private renderRecentDocuments(documents: RecentDocument[]): void {
    this.recentDocuments = documents;
    const totalPages = this.totalPages();
    this.currentPage = totalPages === 0 ? 0 : Math.min(this.currentPage, totalPages - 1);
    this.recentTrack.replaceChildren();
    if (documents.length === 0) {
      this.recentSection.classList.add('is-empty');
      this.recentHint.textContent = '아직 연 문서가 없어요. 한 번 연 문서는 여기에서 바로 다시 열 수 있어요.';
      this.updatePagination();
      return;
    }

    this.recentSection.classList.remove('is-empty');
    this.recentHint.textContent = '최근에 연 문서예요. 눌러서 이어서 작업하세요.';

    const pageStart = this.currentPage * RECENT_DOCUMENTS_PER_PAGE;
    const pageItems = documents.slice(pageStart, pageStart + RECENT_DOCUMENTS_PER_PAGE);
    for (const documentInfo of pageItems) {
      this.recentTrack.appendChild(this.createRecentCard(documentInfo));
    }
    for (let index = pageItems.length; index < RECENT_DOCUMENTS_PER_PAGE; index += 1) {
      this.recentTrack.appendChild(this.createPlaceholderCard());
    }
    this.updatePagination();
  }

  private createRecentCard(documentInfo: RecentDocument): HTMLButtonElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'home-recent-card';
    const meta = document.createElement('div');
    meta.className = 'home-recent-meta';
    const fileName = document.createElement('div');
    fileName.className = 'home-recent-name';
    fileName.textContent = documentInfo.fileName;

    const filePath = document.createElement('div');
    filePath.className = 'home-recent-path';
    filePath.textContent = documentInfo.path;

    meta.append(fileName, filePath);

    const preview = document.createElement('div');
    preview.className = 'home-recent-preview';
    preview.append(
      this.createPreviewLine('home-preview-line is-wide'),
      this.createPreviewLine('home-preview-line'),
      this.createPreviewLine('home-preview-line is-short'),
      this.createPreviewLine('home-preview-line is-wide'),
      this.createPreviewGrid(),
    );
    void this.loadRecentPreview(preview, documentInfo.path);

    card.append(meta, preview);
    card.addEventListener('click', () => {
      void this.openRecentDocument(documentInfo);
    });
    return card;
  }

  private createPlaceholderCard(): HTMLElement {
    const placeholder = document.createElement('div');
    placeholder.className = 'home-recent-card is-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    const meta = document.createElement('div');
    meta.className = 'home-recent-meta';
    const preview = document.createElement('div');
    preview.className = 'home-recent-preview';
    placeholder.append(meta, preview);
    return placeholder;
  }

  private async loadRecentPreview(preview: HTMLElement, path: string): Promise<void> {
    if (!this.bridge.renderDocumentPreview) return;

    try {
      const svgMarkup = await this.bridge.renderDocumentPreview(path);
      const svgNode = parsePreviewSvg(svgMarkup);
      if (!svgNode) return;

      preview.replaceChildren(svgNode);
      preview.classList.add('is-loaded');
    } catch (error) {
      console.warn('[home-screen] recent preview render failed:', error);
    }
  }

  private createPreviewLine(className: string): HTMLElement {
    const line = document.createElement('div');
    line.className = className;
    return line;
  }

  private createPreviewGrid(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'home-preview-grid';
    for (let index = 0; index < 6; index += 1) {
      const cell = document.createElement('div');
      cell.className = 'home-preview-cell';
      grid.appendChild(cell);
    }
    return grid;
  }

  private async openRecentDocument(documentInfo: RecentDocument): Promise<void> {
    if (!this.bridge.openDocumentByPath) return;

    try {
      this.actions.setMessage('파일 로딩 중...');
      const payload = await this.bridge.openDocumentByPath(documentInfo.path);
      if (payload) this.actions.onDocumentLoaded(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.actions.setMessage(`파일 로드 실패: ${message}`);
      console.error('[home-screen] recent document open failed:', error);
    }
  }

  private changePage(direction: -1 | 1): void {
    const nextPage = this.currentPage + direction;
    if (nextPage < 0 || nextPage >= this.totalPages()) return;
    this.currentPage = nextPage;
    this.renderRecentDocuments(this.recentDocuments);
  }

  private updatePagination(): void {
    const totalPages = this.totalPages();
    const hasPages = totalPages > 1;
    this.recentPagination.hidden = !hasPages;
    this.recentPageLabel.textContent = totalPages === 0 ? '' : `${this.currentPage + 1} / ${totalPages}`;
    this.prevButton.disabled = this.currentPage === 0;
    this.nextButton.disabled = totalPages === 0 || this.currentPage >= totalPages - 1;
  }

  private totalPages(): number {
    return Math.ceil(this.recentDocuments.length / RECENT_DOCUMENTS_PER_PAGE);
  }
}
