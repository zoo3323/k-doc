import type { CommandDef, CommandServices } from '@/upstream/commands';
import { ModalDialog } from '@upstream/ui/dialog';
import { showToast } from '@upstream/ui/toast';
import { InsertTextCommand } from '@upstream/engine/command';

/**
 * 한글 메뉴에 있는데 K-Doc 에 없던 기능(docs/operations/hancom-feature-inventory.md).
 * 엔진이 이미 지원하는 것을 사람이 메뉴로 쓸 수 있게 잇는다.
 */

type Services = CommandServices;
type Ih = NonNullable<ReturnType<Services['getInputHandler']>>;

function currentCaret(ih: Ih) {
  return ih.getCursorPosition();
}

// ─── 표 → 쉬운 계산식 ─────────────────────────────────────
// 한글: 가로는 현재 셀 왼쪽 끝부터 바로 왼쪽 셀까지, 세로는 맨 위부터 바로 위 셀까지 계산해 현재 셀에 넣는다.
const EASY_FORMULAS: ReadonlyArray<[string, string, string]> = [
  ['table:easy-sum-h', '가로 합계', '=SUM(left)'],
  ['table:easy-sum-v', '세로 합계', '=SUM(above)'],
  ['table:easy-avg-h', '가로 평균', '=AVG(left)'],
  ['table:easy-avg-v', '세로 평균', '=AVG(above)'],
  ['table:easy-product-h', '가로 곱', '=PRODUCT(left)'],
  ['table:easy-product-v', '세로 곱', '=PRODUCT(above)'],
];

function easyFormulaCommand([id, label, formula]: [string, string, string]): CommandDef {
  return {
    id,
    label,
    canExecute: (ctx) => ctx.inTable,
    execute(services) {
      const ih = services.getInputHandler();
      if (!ih) return;
      const pos = currentCaret(ih);
      if (pos.parentParaIndex === undefined || pos.controlIndex === undefined || pos.cellIndex === undefined) return;
      if ((pos.cellPath?.length ?? 0) > 1) {
        showToast({ message: '표 안의 표에서는 쉬운 계산식을 아직 쓸 수 없어요.' });
        return;
      }
      const sec = pos.sectionIndex;
      const ppi = pos.parentParaIndex;
      const ci = pos.controlIndex;
      let row: number;
      let col: number;
      try {
        ({ row, col } = services.wasm.getCellInfo(sec, ppi, ci, pos.cellIndex));
      } catch {
        return;
      }
      const dryRun = JSON.parse(services.wasm.evaluateTableFormula(sec, ppi, ci, row, col, formula, false));
      if (!dryRun.ok) {
        showToast({ message: '계산할 숫자가 없어요.' });
        return;
      }
      ih.executeOperation({
        kind: 'snapshot',
        operationType: 'tableEasyFormula',
        operation: (wasm) => {
          wasm.evaluateTableFormula(sec, ppi, ci, row, col, formula, true);
          return pos;
        },
      });
    },
  };
}

// ─── 입력 → 필드 넣기(쪽 번호) ────────────────────────────
function insertPageFields(services: Services, kinds: Array<'page' | 'total' | string>): void {
  const ih = services.getInputHandler();
  if (!ih) return;
  const pos = currentCaret(ih);
  if (pos.parentParaIndex !== undefined || pos.cellPath?.length) {
    showToast({ message: '쪽 번호는 본문에서 넣어 주세요. 머리말·꼬리말은 도구 막대의 쪽 번호를 쓰세요.' });
    return;
  }
  ih.executeOperation({
    kind: 'snapshot',
    operationType: 'insertPageNumberField',
    operation: (wasm) => {
      let offset = pos.charOffset;
      for (const kind of kinds) {
        if (kind === 'page' || kind === 'total') {
          const result = wasm.insertPageNumberField(pos.sectionIndex, pos.paragraphIndex, offset, kind);
          if (!result.ok) throw new Error(result.reason ?? '쪽 번호를 넣지 못했습니다');
          offset = result.charOffset ?? offset + 1;
        } else {
          wasm.insertText(pos.sectionIndex, pos.paragraphIndex, offset, kind);
          offset += [...kind].length;
        }
      }
      return { ...pos, charOffset: offset };
    },
  });
}

// ─── 입력 → 날짜/시간 문자열 ─────────────────────────────
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad2 = (n: number) => String(n).padStart(2, '0');
export const DATE_FORMATS: ReadonlyArray<(d: Date) => string> = [
  (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`,
  (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`,
  (d) => `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`,
  (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
  (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours() < 12 ? '오전' : '오후'} ${(d.getHours() % 12) || 12}:${pad2(d.getMinutes())}`,
  (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
];

class DateTimeDialog extends ModalDialog {
  private select!: HTMLSelectElement;

  constructor(private services: Services) {
    super('날짜/시간 문자열', 340);
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.style.padding = '16px';
    this.select = document.createElement('select');
    this.select.size = DATE_FORMATS.length;
    this.select.style.width = '100%';
    const now = new Date();
    DATE_FORMATS.forEach((format, i) => {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = format(now);
      this.select.appendChild(option);
    });
    this.select.value = '1';
    this.select.addEventListener('dblclick', () => {
      (this.dialog.querySelector('.dialog-btn-primary') as HTMLButtonElement | null)?.click();
    });
    body.appendChild(this.select);
    return body;
  }

  show(): void {
    super.show();
    setTimeout(() => this.select.focus(), 30);
  }

  protected onConfirm(): boolean {
    const format = DATE_FORMATS[Number(this.select.value)];
    const ih = this.services.getInputHandler();
    if (!format || !ih) return true;
    ih.executeOperation({ kind: 'command', command: new InsertTextCommand(ih.getCursorPosition(), format(new Date())) });
    this.services.eventBus.emit('document-changed');
    ih.focus();
    return true;
  }
}

// ─── 쪽 → 감추기 ─────────────────────────────────────────
const HIDE_ITEMS: ReadonlyArray<[string, string]> = [
  ['hideHeader', '머리말'],
  ['hideFooter', '꼬리말'],
  ['hideMasterPage', '바탕쪽'],
  ['hideBorder', '테두리'],
  ['hideFill', '배경'],
  ['hidePageNum', '쪽 번호'],
];

class PageHideDialog extends ModalDialog {
  private boxes = new Map<string, HTMLInputElement>();

  constructor(
    private services: Services,
    private pos: { sectionIndex: number; paragraphIndex: number },
    private current: Record<string, boolean>,
  ) {
    super('감추기', 260);
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.style.padding = '12px 16px';
    body.style.display = 'grid';
    body.style.gridTemplateColumns = '1fr 1fr';
    body.style.gap = '8px';
    for (const [key, label] of HIDE_ITEMS) {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.gap = '6px';
      row.style.alignItems = 'center';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = Boolean(this.current[key]);
      this.boxes.set(key, box);
      row.append(box, document.createTextNode(label));
      body.appendChild(row);
    }
    return body;
  }

  protected onConfirm(): boolean {
    const ih = this.services.getInputHandler();
    if (!ih) return true;
    const flags = HIDE_ITEMS.map(([key]) => this.boxes.get(key)?.checked ?? false);
    const { sectionIndex, paragraphIndex } = this.pos;
    ih.executeOperation({
      kind: 'snapshot',
      operationType: 'pageHide',
      operation: (wasm) => {
        (wasm as any).doc.setPageHide(sectionIndex, paragraphIndex, ...flags);
        return ih.getCursorPosition();
      },
      meta: { actionId: 'page:hide', domain: 'page', refresh: 'full', dirtyScope: 'document' },
    });
    return true;
  }
}

function openPageHide(services: Services): void {
  const ih = services.getInputHandler();
  if (!ih) return;
  const pos = currentCaret(ih);
  if (pos.parentParaIndex !== undefined) {
    showToast({ message: '감추기는 본문 문단에서 열어 주세요.' });
    return;
  }
  let current: Record<string, boolean> = {};
  try {
    current = JSON.parse((services.wasm as any).doc.getPageHide(pos.sectionIndex, pos.paragraphIndex));
  } catch {
    current = {};
  }
  new PageHideDialog(services, pos, current).show();
}

// ─── 입력 → 글자 겹치기 ───────────────────────────────────
const OVERLAP_KINDS: ReadonlyArray<[number, string]> = [
  [0, '모양 없음(글자끼리)'], [1, '원'], [2, '반전 원'], [3, '사각형'], [4, '반전 사각형'],
];
const OVERLAP_SIZES: ReadonlyArray<[number, string]> = [
  [0, '100%'], [-1, '90%'], [-2, '80%'], [-3, '70%'], [-4, '60%'], [-5, '50%'],
];

class CharOverlapDialog extends ModalDialog {
  private text!: HTMLInputElement;
  private kind!: HTMLSelectElement;
  private size!: HTMLSelectElement;

  constructor(private services: Services) {
    super('글자 겹치기', 300);
  }

  private select(options: ReadonlyArray<[number, string]>, value: number): HTMLSelectElement {
    const el = document.createElement('select');
    el.style.width = '100%';
    for (const [v, label] of options) {
      const option = document.createElement('option');
      option.value = String(v);
      option.textContent = label;
      el.appendChild(option);
    }
    el.value = String(value);
    return el;
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.style.padding = '12px 16px';
    body.style.display = 'grid';
    body.style.gridTemplateColumns = 'auto 1fr';
    body.style.gap = '8px 10px';
    body.style.alignItems = 'center';
    this.text = document.createElement('input');
    this.text.maxLength = 9;
    this.text.placeholder = '예: 1';
    this.kind = this.select(OVERLAP_KINDS, 1);
    this.size = this.select(OVERLAP_SIZES, 0);
    body.append(
      document.createTextNode('겹쳐 쓸 글자'), this.text,
      document.createTextNode('겹치기 종류'), this.kind,
      document.createTextNode('글자 크기'), this.size,
    );
    return body;
  }

  show(): void {
    super.show();
    setTimeout(() => this.text.focus(), 30);
  }

  protected onConfirm(): boolean {
    const text = this.text.value.trim();
    if (!text) return false;
    const ih = this.services.getInputHandler();
    if (!ih) return true;
    const pos = ih.getCursorPosition();
    const borderType = Number(this.kind.value);
    const innerSize = Number(this.size.value);
    ih.executeOperation({
      kind: 'snapshot',
      operationType: 'insertCharOverlap',
      operation: (wasm) => {
        const result = wasm.insertCharOverlap(pos.sectionIndex, pos.paragraphIndex, pos.charOffset, text, borderType, innerSize);
        if (!result.ok) throw new Error(result.error ?? '글자 겹치기를 넣지 못했습니다');
        return { ...pos, charOffset: pos.charOffset + 1 };
      },
    });
    ih.focus();
    return true;
  }
}

// ─── 입력 → 주석 → 각주/미주 변환 ─────────────────────────
class ConvertNotesDialog extends ModalDialog {
  private toEndnote!: HTMLInputElement;

  constructor(private services: Services) {
    super('각주/미주 변환', 280);
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.style.padding = '12px 16px';
    body.style.display = 'grid';
    body.style.gap = '8px';
    const radio = (label: string, checked: boolean) => {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.gap = '6px';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'kdoc-convert-notes';
      input.checked = checked;
      row.append(input, document.createTextNode(label));
      body.appendChild(row);
      return input;
    };
    this.toEndnote = radio('각주를 미주로', true);
    radio('미주를 각주로', false);
    return body;
  }

  protected onConfirm(): boolean {
    const ih = this.services.getInputHandler();
    if (!ih) return true;
    const toEndnote = this.toEndnote.checked;
    let converted = 0;
    ih.executeOperation({
      kind: 'snapshot',
      operationType: 'convertNotes',
      operation: (wasm) => {
        converted = wasm.convertNotes(toEndnote).converted;
        return converted > 0 ? ih.getCursorPosition() : null;
      },
    });
    showToast({ message: converted > 0 ? `${converted}개를 바꿨어요.` : '바꿀 주석이 없어요.' });
    return true;
  }
}

// ─── 표 → 문자열을 표로 / 표를 문자열로 ───────────────────
const SEPARATORS: ReadonlyArray<[string, string]> = [['tab', '탭'], ['comma', '쉼표(,)'], ['space', '빈칸']];

class SeparatorDialog extends ModalDialog {
  private choice!: HTMLSelectElement;

  constructor(title: string, private onPick: (separator: string) => void) {
    super(title, 260);
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.style.padding = '12px 16px';
    body.style.display = 'grid';
    body.style.gridTemplateColumns = 'auto 1fr';
    body.style.gap = '8px 10px';
    body.style.alignItems = 'center';
    this.choice = document.createElement('select');
    for (const [value, label] of SEPARATORS) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      this.choice.appendChild(option);
    }
    body.append(document.createTextNode('구분 기호'), this.choice);
    return body;
  }

  protected onConfirm(): boolean {
    this.onPick(this.choice.value);
    return true;
  }
}

function textToTable(services: Services): void {
  const ih = services.getInputHandler();
  const selection = ih?.getSelection();
  if (!ih || !selection) return;
  const { start, end } = selection;
  if (start.parentParaIndex !== undefined || end.parentParaIndex !== undefined || start.sectionIndex !== end.sectionIndex) {
    showToast({ message: '본문 문단을 골라 주세요.' });
    return;
  }
  new SeparatorDialog('문자열을 표로', (separator) => {
    let failed = '';
    ih.executeOperation({
      kind: 'snapshot',
      operationType: 'textToTable',
      operation: (wasm) => {
        const result = wasm.textToTable(start.sectionIndex, start.paragraphIndex, end.paragraphIndex, separator);
        if (!result.ok) {
          failed = result.reason ?? '표로 바꾸지 못했어요.';
          return null;
        }
        return { sectionIndex: start.sectionIndex, paragraphIndex: result.paraIdx ?? start.paragraphIndex, charOffset: 0 };
      },
    });
    if (failed) showToast({ message: failed });
  }).show();
}

function tableToText(services: Services): void {
  const ih = services.getInputHandler();
  if (!ih) return;
  const pos = currentCaret(ih);
  if (pos.parentParaIndex === undefined || pos.controlIndex === undefined || (pos.cellPath?.length ?? 0) > 1) {
    showToast({ message: '본문 표 안에서 써 주세요.' });
    return;
  }
  const sec = pos.sectionIndex;
  const ppi = pos.parentParaIndex;
  const ci = pos.controlIndex;
  new SeparatorDialog('표를 문자열로', (separator) => {
    ih.executeOperation({
      kind: 'snapshot',
      operationType: 'tableToText',
      operation: (wasm) => {
        const result = wasm.tableToText(sec, ppi, ci, separator);
        if (!result.ok) return null;
        return { sectionIndex: sec, paragraphIndex: result.paraIdx ?? ppi, charOffset: result.charOffset ?? 0 };
      },
    });
  }).show();
}

// ─── 쪽 → 쪽 번호 매기기 ─────────────────────────────────
const PAGE_NUMBER_POSITIONS: ReadonlyArray<[number, string]> = [
  [0, '없음'],
  [1, '왼쪽 위'], [2, '가운데 위'], [3, '오른쪽 위'],
  [4, '왼쪽 아래'], [5, '가운데 아래'], [6, '오른쪽 아래'],
  [7, '바깥쪽 위'], [8, '바깥쪽 아래'], [9, '안쪽 위'], [10, '안쪽 아래'],
];
// 표 134 번호 모양 중 엔진이 그대로 그리는 것만.
const PAGE_NUMBER_FORMATS: ReadonlyArray<[number, string]> = [
  [0, '1, 2, 3'], [1, '①, ②, ③'], [2, 'I, II, III'], [3, 'i, ii, iii'], [4, 'A, B, C'], [5, 'a, b, c'],
];

class PageNumberPosDialog extends ModalDialog {
  private position!: HTMLSelectElement;
  private format!: HTMLSelectElement;
  private dash!: HTMLInputElement;

  constructor(
    private services: Services,
    private pos: { sectionIndex: number; paragraphIndex: number },
    private current: { position?: number; format?: number; dash?: boolean },
  ) {
    super('쪽 번호 매기기', 300);
  }

  private select(options: ReadonlyArray<[number, string]>, value: number): HTMLSelectElement {
    const el = document.createElement('select');
    el.style.width = '100%';
    for (const [v, label] of options) {
      const option = document.createElement('option');
      option.value = String(v);
      option.textContent = label;
      el.appendChild(option);
    }
    el.value = String(value);
    return el;
  }

  protected createBody(): HTMLElement {
    const body = document.createElement('div');
    body.style.padding = '12px 16px';
    body.style.display = 'grid';
    body.style.gridTemplateColumns = 'auto 1fr';
    body.style.gap = '8px 10px';
    body.style.alignItems = 'center';
    this.position = this.select(PAGE_NUMBER_POSITIONS, this.current.position ?? 5);
    this.format = this.select(PAGE_NUMBER_FORMATS, this.current.format ?? 0);
    this.dash = document.createElement('input');
    this.dash.type = 'checkbox';
    this.dash.checked = this.current.dash ?? false;
    const dashLabel = document.createElement('label');
    dashLabel.style.display = 'flex';
    dashLabel.style.gap = '6px';
    dashLabel.append(this.dash, document.createTextNode('줄표 넣기 (- 1 -)'));
    body.append(
      document.createTextNode('번호 위치'), this.position,
      document.createTextNode('번호 모양'), this.format,
      document.createElement('span'), dashLabel,
    );
    return body;
  }

  protected onConfirm(): boolean {
    const ih = this.services.getInputHandler();
    if (!ih) return true;
    const { sectionIndex, paragraphIndex } = this.pos;
    const format = Number(this.format.value);
    const position = Number(this.position.value);
    const dash = this.dash.checked;
    ih.executeOperation({
      kind: 'snapshot',
      operationType: 'setPageNumberPos',
      operation: (wasm) => {
        wasm.setPageNumberPos(sectionIndex, paragraphIndex, format, position, dash);
        return ih.getCursorPosition();
      },
      meta: { actionId: 'page:page-number-pos', domain: 'page', refresh: 'full', dirtyScope: 'document' },
    });
    return true;
  }
}

function openPageNumberPos(services: Services): void {
  const ih = services.getInputHandler();
  if (!ih) return;
  const pos = currentCaret(ih);
  if (pos.parentParaIndex !== undefined) {
    showToast({ message: '쪽 번호 매기기는 본문 문단에서 열어 주세요.' });
    return;
  }
  let current: { position?: number; format?: number; dash?: boolean } = {};
  try {
    const got = services.wasm.getPageNumberPos(pos.sectionIndex, pos.paragraphIndex);
    if (got.exists) current = got;
  } catch {
    current = {};
  }
  new PageNumberPosDialog(services, pos, current).show();
}

// ─── 보기 ───────────────────────────────────────────────
function toggleRootClass(name: string): void {
  document.documentElement.classList.toggle(name);
  window.dispatchEvent(new Event('resize'));
}

async function toggleFullscreen(): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    await win.setFullscreen(!(await win.isFullscreen()));
  } catch {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen?.();
  }
}

export const hancomCommands: CommandDef[] = [
  ...EASY_FORMULAS.map(easyFormulaCommand),
  {
    id: 'insert:field-page-number',
    label: '현재 쪽 번호',
    canExecute: (ctx) => ctx.hasDocument && !ctx.inTable,
    execute(services) { insertPageFields(services, ['page']); },
  },
  {
    id: 'insert:field-total-pages',
    label: '전체 쪽수',
    canExecute: (ctx) => ctx.hasDocument && !ctx.inTable,
    execute(services) { insertPageFields(services, ['total']); },
  },
  {
    id: 'insert:field-page-of-total',
    label: '현재 쪽/전체 쪽수',
    canExecute: (ctx) => ctx.hasDocument && !ctx.inTable,
    execute(services) { insertPageFields(services, ['page', '/', 'total']); },
  },
  {
    id: 'insert:date-time-string',
    label: '날짜/시간 문자열',
    shortcutLabel: 'Ctrl+K,D',
    canExecute: (ctx) => ctx.hasDocument && ctx.isEditable,
    execute(services) { new DateTimeDialog(services).show(); },
  },
  {
    id: 'page:hide-dialog',
    label: '감추기',
    canExecute: (ctx) => ctx.hasDocument && !ctx.inTable,
    execute(services) { openPageHide(services); },
  },
  {
    id: 'insert:char-overlap',
    label: '글자 겹치기',
    canExecute: (ctx) => ctx.hasDocument && ctx.isEditable && !ctx.inTable,
    execute(services) {
      const pos = services.getInputHandler()?.getCursorPosition();
      if (pos && (pos.parentParaIndex !== undefined || pos.cellPath?.length)) {
        showToast({ message: '글자 겹치기는 본문 문단에 넣어 주세요.' });
        return;
      }
      new CharOverlapDialog(services).show();
    },
  },
  {
    id: 'insert:convert-notes',
    label: '각주/미주 변환',
    canExecute: (ctx) => ctx.hasDocument && ctx.isEditable,
    execute(services) { new ConvertNotesDialog(services).show(); },
  },
  {
    id: 'table:text-to-table',
    label: '문자열을 표로',
    canExecute: (ctx) => ctx.hasDocument && ctx.isEditable && ctx.hasSelection && !ctx.inTable,
    execute(services) { textToTable(services); },
  },
  {
    id: 'table:table-to-text',
    label: '표를 문자열로',
    canExecute: (ctx) => ctx.hasDocument && ctx.isEditable && ctx.inTable,
    execute(services) { tableToText(services); },
  },
  {
    id: 'page:page-number-pos',
    label: '쪽 번호 매기기',
    shortcutLabel: 'Ctrl+M,P',
    canExecute: (ctx) => ctx.hasDocument && !ctx.inTable,
    execute(services) { openPageNumberPos(services); },
  },
  {
    id: 'format:toggle-outline',
    label: '개요 적용/해제',
    canExecute: (ctx) => ctx.hasDocument && ctx.isEditable,
    execute(services) {
      (services.getInputHandler() as unknown as { toggleOutline?: () => void } | null)?.toggleOutline?.();
    },
  },
  {
    id: 'view:toggle-ruler',
    label: '눈금자',
    execute() { toggleRootClass('kdoc-no-ruler'); },
  },
  {
    id: 'view:toggle-status-bar',
    label: '상황 선',
    execute() { toggleRootClass('kdoc-no-status'); },
  },
  {
    id: 'view:grayscale',
    label: '회색조',
    execute() { document.documentElement.classList.toggle('kdoc-grayscale'); },
  },
  {
    id: 'view:fullscreen',
    label: '전체 화면',
    execute() { void toggleFullscreen(); },
  },
];
