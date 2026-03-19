/**
 * POCAAlbum 앨범 생성 페이지 객체
 *
 * URL: /pocaalbum/album/create
 */

import { Page, Locator, expect } from '@playwright/test';
import { AdminBasePage, ADMIN_TIMEOUTS } from './admin-base.page';
import * as path from 'path';

// ============================================================================
// 앨범 생성 옵션 타입
// ============================================================================

export interface AlbumCreateOptions {
  title: string;
  albumType?: string;
  releaseDate?: string;
  imagePath?: string;
}

// ============================================================================
// PocaAlbumCreatePage 클래스
// ============================================================================

export class PocaAlbumCreatePage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 로케이터 정의
  // --------------------------------------------------------------------------

  readonly titleInput: Locator;
  readonly albumTypeSelect: Locator;
  readonly releaseDateInput: Locator;
  readonly fileInput: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    // 제목 입력 - placeholder 기반 (폴백: input 탐색)
    this.titleInput = page.locator('input[placeholder*="제목"], input[placeholder*="앨범명"], input[placeholder*="타이틀"]').first();
    // 앨범타입 드롭다운
    this.albumTypeSelect = page.locator('select:near(:text("앨범타입")), [role="combobox"]:near(:text("앨범타입"))').first();
    // 발매일 입력
    this.releaseDateInput = page.locator('input[placeholder*="발매일"], input[type="date"]').first();
    // 이미지 업로드
    this.fileInput = page.locator('input[type="file"]').first();
    // 등록하기 버튼 (pink 계열)
    this.createButton = page.locator('button:has-text("등록"), button:has-text("저장"), button:has-text("생성")').first();
    // 취소하기 버튼
    this.cancelButton = page.locator('button:has-text("취소")').first();
  }

  // --------------------------------------------------------------------------
  // 추상 메서드 구현
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/pocaalbum/album/create`;
  }

  getHeadingText(): string {
    return '앨범';
  }

  // --------------------------------------------------------------------------
  // 폼 입력 메서드
  // --------------------------------------------------------------------------

  /** 제목 입력 */
  async fillTitle(title: string): Promise<void> {
    await this.titleInput.waitFor({ state: 'visible', timeout: this.timeouts.medium });
    await this.titleInput.fill(title);
  }

  /** 앨범타입 선택 */
  async selectAlbumType(type: string): Promise<void> {
    const isVisible = await this.albumTypeSelect.isVisible({ timeout: 3000 }).catch(() => false);
    if (!isVisible) {
      console.log('ℹ️ 앨범타입 필드를 찾을 수 없음 - 건너뜀');
      return;
    }

    // select 태그인 경우
    const tagName = await this.albumTypeSelect.evaluate(el => el.tagName.toLowerCase());
    if (tagName === 'select') {
      await this.albumTypeSelect.selectOption({ label: type });
    } else {
      // combobox 클릭 → 옵션 선택
      await this.albumTypeSelect.click();
      await this.page.locator(`[role="option"]:has-text("${type}"), li:has-text("${type}")`).first().click();
    }
  }

  /** 발매일 입력 */
  async fillReleaseDate(date: string): Promise<void> {
    const isVisible = await this.releaseDateInput.isVisible({ timeout: 3000 }).catch(() => false);
    if (!isVisible) {
      console.log('ℹ️ 발매일 필드를 찾을 수 없음 - 건너뜀');
      return;
    }
    await this.releaseDateInput.fill(date);
    await this.releaseDateInput.press('Tab');
  }

  /** 이미지 파일 업로드 */
  async uploadImage(filePath: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(__dirname, '..', filePath);

    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(absolutePath);
    console.log(`ℹ️ 이미지 업로드 시도: ${absolutePath}`);
  }

  /** 전체 폼 입력 통합 */
  async fillCreateForm(options: AlbumCreateOptions): Promise<void> {
    await this.fillTitle(options.title);

    if (options.albumType) {
      await this.selectAlbumType(options.albumType);
    }

    if (options.releaseDate) {
      await this.fillReleaseDate(options.releaseDate);
    }

    if (options.imagePath) {
      await this.uploadImage(options.imagePath);
    }
  }

  /** 등록 클릭 + 목록 이동 대기 */
  async submitAndWaitForList(): Promise<void> {
    await this.createButton.scrollIntoViewIfNeeded();

    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null),
      this.createButton.click({ force: true }),
    ]);

    // 목록 페이지 확인
    const currentUrl = this.page.url();
    if (!currentUrl.includes('/pocaalbum/album/list')) {
      // confirm 다이얼로그 대응
      this.page.once('dialog', dialog => dialog.accept());
      await this.page.waitForURL(/\/pocaalbum\/album/, { timeout: 10000 }).catch(() => {});
    }

    await this.waitForLoadState('domcontentloaded');
  }

  /**
   * 폼 필드 자동 탐색 (디버깅용)
   * 첫 실행 시 폼의 정확한 필드 구조 파악
   */
  async discoverFormFields(): Promise<Record<string, string>> {
    const fields: Record<string, string> = {};

    // input 필드 탐색
    const inputs = this.page.locator('input:visible');
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const type = await input.getAttribute('type') || 'text';
      const placeholder = await input.getAttribute('placeholder') || '';
      const name = await input.getAttribute('name') || '';
      const id = await input.getAttribute('id') || '';
      fields[`input[${i}]`] = `type=${type}, placeholder="${placeholder}", name="${name}", id="${id}"`;
    }

    // select 필드 탐색
    const selects = this.page.locator('select:visible');
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const sel = selects.nth(i);
      const name = await sel.getAttribute('name') || '';
      const id = await sel.getAttribute('id') || '';
      fields[`select[${i}]`] = `name="${name}", id="${id}"`;
    }

    // textarea 필드 탐색
    const textareas = this.page.locator('textarea:visible');
    const textareaCount = await textareas.count();
    for (let i = 0; i < textareaCount; i++) {
      const ta = textareas.nth(i);
      const placeholder = await ta.getAttribute('placeholder') || '';
      const name = await ta.getAttribute('name') || '';
      fields[`textarea[${i}]`] = `placeholder="${placeholder}", name="${name}"`;
    }

    console.log('📋 폼 필드 탐색 결과:');
    for (const [key, value] of Object.entries(fields)) {
      console.log(`  ${key}: ${value}`);
    }

    return fields;
  }
}
