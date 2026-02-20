/**
 * 주문관리 목록 페이지 객체
 */

import { Page, Locator, expect } from '@playwright/test';
import { AdminBasePage, ADMIN_TIMEOUTS } from './admin-base.page';

export type OrderTabKey = 'all' | 'b2c' | 'b2b' | 'project';

export interface OrderStatusSnapshot {
  orderStatus: string;
  paymentStatus: string;
  deliveryStatus: string;
  stockAllocationStatus: string;
}

/**
 * TODO(env): 상태 필터 순서가 변경되면 fallback 인덱스를 조정하세요.
 * 기준: 주문상태(0), 결제상태(1), 배송상태(2), 재고할당(4)
 */
const STATUS_FILTER_FALLBACK_INDEX = {
  orderStatus: 0,
  paymentStatus: 1,
  deliveryStatus: 2,
  stockAllocationStatus: 4,
} as const;

export class OrderListPage extends AdminBasePage {
  readonly submitSearchButton: Locator;
  readonly searchResetButton: Locator;
  readonly resultSummary: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    this.submitSearchButton = page.getByRole('button', { name: '조회하기', exact: true });
    this.searchResetButton = page.getByRole('button', { name: '검색 초기화', exact: true });
    this.resultSummary = page.getByText(/상품 주문내역|프로젝트별 주문내역/i).first();
  }

  getPageUrl(): string {
    return `${this.baseUrl}/order/list`;
  }

  getHeadingText(): string {
    return '주문관리';
  }

  getBreadcrumbPath(): string[] {
    return ['주문/배송', '주문관리'];
  }

  async clickSearchAndWait(): Promise<void> {
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.submitSearchButton.click({ force: true });
    await this.waitForTableOrNoResult();
  }

  async clickResetButton(): Promise<void> {
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.keyboard.press('Escape').catch(() => {});

    if (await this.searchResetButton.isVisible({ timeout: this.timeouts.short }).catch(() => false)) {
      const enabled = await this.searchResetButton.isEnabled().catch(() => false);
      if (enabled) {
        await this.searchResetButton.click({ force: true });
      }
    }
    await this.waitForTableOrNoResult();
  }

  async waitForTableOrNoResult(timeout: number = this.timeouts.navigation): Promise<void> {
    await Promise.race([
      this.resultSummary.waitFor({ state: 'visible', timeout }).catch(() => null),
      this.noResultMessage.waitFor({ state: 'visible', timeout }).catch(() => null),
    ]);

    await this.page.waitForFunction(
      () => {
        const text = (document.body.innerText || '').replace(/\s+/g, ' ');
        const hasNoResult = text.includes('검색결과가 없습니다');
        const hasList = text.includes('상품 주문내역') || text.includes('프로젝트별 주문내역');
        const checkboxCount = document.querySelectorAll('input[type="checkbox"]').length;
        const hasTable = document.querySelectorAll('table').length > 0;
        return hasNoResult || (hasList && (checkboxCount >= 1 || hasTable));
      },
      undefined,
      { timeout }
    );
  }

  async getRowCount(): Promise<number> {
    const totalCheckboxCount = await this.page.locator('input[type="checkbox"]').count();
    return Math.max(totalCheckboxCount - 1, 0);
  }

  async assertTabsVisible(): Promise<void> {
    await expect(await this.resolveTab('all')).toBeVisible({ timeout: this.timeouts.long });
    await expect(await this.resolveTab('b2c')).toBeVisible({ timeout: this.timeouts.long });
    await expect(await this.resolveTab('b2b')).toBeVisible({ timeout: this.timeouts.long });
    await expect(await this.resolveTab('project')).toBeVisible({ timeout: this.timeouts.long });
  }

  async switchTab(tab: OrderTabKey): Promise<void> {
    const tabLocator = await this.resolveTab(tab);
    await tabLocator.scrollIntoViewIfNeeded().catch(() => {});
    await tabLocator.click({ force: true });
    await this.waitForTableOrNoResult();
  }

  async isProjectFilterVisible(): Promise<boolean> {
    const projectFilter = await this.findFirstVisible([
      this.page.getByRole('combobox', { name: /프로젝트|project/i }).first(),
      this.page.getByLabel(/프로젝트|project/i).first(),
      this.page.locator('p, span, div').filter({ hasText: /프로젝트|project/i }).first(),
    ]);
    return projectFilter !== null;
  }

  async searchByKeyword(keyword: string): Promise<void> {
    const keywordInput = await this.findFirstVisible([
      this.page.getByRole('textbox', { name: /주문번호|주문 번호|검색어|keyword/i }).first(),
      this.page.getByPlaceholder(/주문번호|주문 번호|검색어|검색/i).first(),
      this.page.getByPlaceholder('주문번호를 입력해주세요').first(),
    ]);

    if (!keywordInput) {
      throw new Error('키워드 검색 입력창을 찾지 못했습니다. TODO(env): 주문번호 입력창 셀렉터를 확인하세요.');
    }

    await keywordInput.fill(keyword);
    await this.clickSearchAndWait();
  }

  async resetFiltersAndWait(): Promise<void> {
    await this.clickResetButton();
  }

  async getFilterableStatusSnapshot(): Promise<OrderStatusSnapshot> {
    const rowText = await this.getFirstRowText();
    const orderStatus = await this.resolveStatusValue('orderStatus', rowText);
    const paymentStatus = await this.resolveStatusValue('paymentStatus', rowText);
    const deliveryStatus = await this.resolveStatusValue('deliveryStatus', rowText);
    const stockAllocationStatus = await this.resolveStatusValue('stockAllocationStatus', rowText);

    return {
      orderStatus,
      paymentStatus,
      deliveryStatus,
      stockAllocationStatus,
    };
  }

  private async resolveStatusValue(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    rowText: string
  ): Promise<string> {
    const selectedValue = await this.getCurrentSelectedValue(key);
    if (this.isMeaningfulValue(selectedValue)) {
      return selectedValue;
    }
    return await this.pickStatusFromRowText(key, rowText);
  }

  async applyCombinedStatusFilters(snapshot: OrderStatusSnapshot): Promise<void> {
    await this.selectStatusOption('deliveryStatus', snapshot.deliveryStatus);
    await this.selectStatusOption('stockAllocationStatus', snapshot.stockAllocationStatus);
    await this.selectStatusOption('orderStatus', snapshot.orderStatus);
    await this.selectStatusOption('paymentStatus', snapshot.paymentStatus);
  }

  async getSelectedStatusSnapshot(): Promise<OrderStatusSnapshot> {
    const snapshot = {
      orderStatus: await this.getCurrentSelectedValue('orderStatus'),
      paymentStatus: await this.getCurrentSelectedValue('paymentStatus'),
      deliveryStatus: await this.getCurrentSelectedValue('deliveryStatus'),
      stockAllocationStatus: await this.getCurrentSelectedValue('stockAllocationStatus'),
    };

    expect(this.isMeaningfulValue(snapshot.orderStatus), '주문상태 필터 값이 비어 있습니다.').toBeTruthy();
    expect(this.isMeaningfulValue(snapshot.paymentStatus), '결제상태 필터 값이 비어 있습니다.').toBeTruthy();
    expect(this.isMeaningfulValue(snapshot.deliveryStatus), '배송상태 필터 값이 비어 있습니다.').toBeTruthy();
    expect(this.isMeaningfulValue(snapshot.stockAllocationStatus), '재고할당 필터 값이 비어 있습니다.').toBeTruthy();

    return snapshot;
  }

  async assertRowsMatchStatus(snapshot: OrderStatusSnapshot, sampleLimit: number = 10): Promise<void> {
    const rowTexts = await this.getRowTexts(sampleLimit);
    expect(rowTexts.length, '상태 조합 검색 결과가 없습니다.').toBeGreaterThan(0);

    expect(this.isMeaningfulValue(snapshot.orderStatus), '주문상태 검증 값이 비어 있습니다.').toBeTruthy();
    expect(this.isMeaningfulValue(snapshot.paymentStatus), '결제상태 검증 값이 비어 있습니다.').toBeTruthy();
    expect(this.isMeaningfulValue(snapshot.deliveryStatus), '배송상태 검증 값이 비어 있습니다.').toBeTruthy();
    expect(this.isMeaningfulValue(snapshot.stockAllocationStatus), '재고할당 검증 값이 비어 있습니다.').toBeTruthy();

    for (const rowText of rowTexts) {
      expect(rowText).toContain(this.normalize(snapshot.orderStatus));
      expect(rowText).toContain(this.normalize(snapshot.paymentStatus));
      expect(rowText).toContain(this.normalize(snapshot.deliveryStatus));
      expect(rowText).toContain(this.normalize(snapshot.stockAllocationStatus));
    }
  }

  async hasNoResultOrEmptyTable(): Promise<boolean> {
    const hasNoResult = await this.noResultMessage.isVisible().catch(() => false);
    if (hasNoResult) {
      return true;
    }
    const rowCount = await this.getRowCount();
    return rowCount === 0;
  }

  private async pickStatusFromRowText(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    rowText: string
  ): Promise<string> {
    const options = await this.getStatusOptions(key);
    const normalizedRow = this.normalize(rowText);
    const matched = options.find((option) => normalizedRow.includes(this.normalize(option)));

    if (matched) {
      return matched;
    }

    if (options.length > 0) {
      return options[0];
    }

    const inferred = this.inferStatusByKeyword(key, normalizedRow);
    if (this.isMeaningfulValue(inferred)) {
      return inferred;
    }

    const selectedValue = await this.getCurrentSelectedValue(key);
    if (this.isMeaningfulValue(selectedValue)) {
      return selectedValue;
    }

    throw new Error(`행 데이터와 매칭되는 상태 옵션을 찾지 못했습니다: ${key}`);
  }

  private async getStatusOptions(key: keyof typeof STATUS_FILTER_FALLBACK_INDEX): Promise<string[]> {
    const fallbackIndex = STATUS_FILTER_FALLBACK_INDEX[key];
    const trigger = await this.findStatusFilterTrigger(this.getStatusLabelRegex(key), fallbackIndex);

    if (!trigger) {
      throw new Error(`상태 필터를 찾지 못했습니다: ${key}`);
    }

    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    await trigger.click({ force: true });

    const optionCandidates = await this.page
      .locator('.multiselect__option:visible, [role="option"]:visible, li[role="option"]:visible')
      .allTextContents();

    await this.page.keyboard.press('Escape').catch(() => {});

    const cleaned = optionCandidates
      .map((option) => this.normalize(option))
      .filter((option) => this.isMeaningfulValue(option))
      .filter((option) => !/선택|전체|all/i.test(option));

    return Array.from(new Set(cleaned));
  }

  private async getCurrentSelectedValue(key: keyof typeof STATUS_FILTER_FALLBACK_INDEX): Promise<string> {
    const fallbackIndex = STATUS_FILTER_FALLBACK_INDEX[key];
    const trigger = await this.findStatusFilterTrigger(this.getStatusLabelRegex(key), fallbackIndex);
    if (!trigger) {
      throw new Error(`선택된 상태 값을 읽을 수 없습니다: ${key}`);
    }

    const text = this.normalize(await trigger.textContent().catch(() => ''));
    return /선택|searchbox/i.test(text) ? '' : text;
  }

  private async selectStatusOption(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    optionText: string
  ): Promise<void> {
    if (!this.isMeaningfulValue(optionText)) {
      throw new Error(`의미 없는 상태값으로 필터를 적용할 수 없습니다: ${key}=${optionText}`);
    }

    const fallbackIndex = STATUS_FILTER_FALLBACK_INDEX[key];
    const trigger = await this.findStatusFilterTrigger(this.getStatusLabelRegex(key), fallbackIndex);

    if (!trigger) {
      throw new Error(`상태 필터를 찾지 못했습니다: ${key}`);
    }

    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    await trigger.click({ force: true });

    const currentText = this.normalize(await trigger.textContent().catch(() => ''));
    if (currentText.includes(this.normalize(optionText))) {
      await this.page.keyboard.press('Escape').catch(() => {});
      return;
    }

    const option = await this.findFirstVisible([
      this.page.getByRole('option', { name: new RegExp(`^${this.escapeRegExp(optionText)}$`) }).first(),
      this.page.getByRole('option', { name: new RegExp(this.escapeRegExp(optionText)) }).first(),
      this.page.locator('.multiselect__option').filter({ hasText: optionText }).first(),
      this.page.locator('[role="option"], li').filter({ hasText: optionText }).first(),
      this.page.getByText(optionText, { exact: true }).first(),
    ]);

    if (option) {
      await option.scrollIntoViewIfNeeded().catch(() => {});
      const handle = await option.elementHandle({ timeout: this.timeouts.short }).catch(() => null);
      if (handle) {
        await handle.evaluate((el) => {
          (el as HTMLElement).click();
        });
        await handle.dispose().catch(() => {});
        await this.page.keyboard.press('Escape').catch(() => {});
        return;
      }
    }

    // 우선순위 2: combobox 내부 searchbox에 값 입력 후 Enter
    const searchInput = await this.findFirstVisible([
      trigger.locator('input').first(),
      this.page.locator('input[placeholder="선택"]:visible').first(),
      this.page.locator('input[role="textbox"]:visible').first(),
    ]);

    if (searchInput) {
      await searchInput.fill(optionText).catch(() => {});
      await searchInput.press('Enter').catch(() => {});

      const selectedByInput = await trigger
        .filter({ hasText: new RegExp(this.escapeRegExp(optionText)) })
        .first()
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);

      if (selectedByInput) {
        await this.page.keyboard.press('Escape').catch(() => {});
        return;
      }
    }
    await this.page.keyboard.press('Escape').catch(() => {});
    throw new Error(`상태 옵션을 찾지 못했습니다: ${optionText}`);
  }

  private async findStatusFilterTrigger(labelRegex: RegExp, fallbackIndex: number): Promise<Locator | null> {
    return await this.findFirstVisible([
      this.page.getByRole('combobox', { name: labelRegex }).first(),
      this.page.getByLabel(labelRegex).first(),
      this.page.locator('p').filter({ hasText: labelRegex }).locator('xpath=..').locator('[role="combobox"]').first(),
      this.page.locator('[role="combobox"]').nth(fallbackIndex),
    ]);
  }

  private getStatusLabelRegex(key: keyof typeof STATUS_FILTER_FALLBACK_INDEX): RegExp {
    switch (key) {
      case 'orderStatus':
        return /주문\s*상태|order\s*status/i;
      case 'paymentStatus':
        return /결제\s*상태|payment\s*status/i;
      case 'deliveryStatus':
        return /배송\s*상태|delivery\s*status/i;
      case 'stockAllocationStatus':
        return /재고\s*할당|할당\s*상태|allocation|stock/i;
      default:
        return /상태/i;
    }
  }

  private async getFirstRowText(): Promise<string> {
    const rowTexts = await this.getRowTexts(1);
    expect(rowTexts.length, '주문 목록 행 데이터를 찾지 못했습니다.').toBeGreaterThan(0);
    return rowTexts[0];
  }

  private async getRowTexts(limit: number = 10): Promise<string[]> {
    const texts = await this.page.evaluate((sampleLimit) => {
      const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      const rowTexts: string[] = [];

      for (let i = 1; i < checkboxes.length; i++) {
        const checkbox = checkboxes[i] as HTMLElement;
        let current: HTMLElement | null = checkbox;
        let captured = '';

        while (current) {
          const text = normalize(current.innerText || '');
          const ownCheckboxCount = current.querySelectorAll('input[type="checkbox"]').length;
          const looksLikeHeader = text.includes('주문 번호') && text.includes('결제 상태');

          if (!looksLikeHeader && ownCheckboxCount === 1 && text.length > 20) {
            captured = text;
            break;
          }
          current = current.parentElement;
        }

        if (captured) {
          rowTexts.push(captured);
        }
        if (rowTexts.length >= sampleLimit) {
          break;
        }
      }

      return rowTexts;
    }, limit);

    return texts.map((text) => this.normalize(text));
  }

  private async resolveTab(tab: OrderTabKey): Promise<Locator> {
    const label = this.getTabLabel(tab);
    const exactRegex = new RegExp(`^\\s*${this.escapeRegExp(label)}\\s*$`);
    const tabContainer = this.page
      .locator('h1, h2')
      .filter({ hasText: /주문관리|Order/i })
      .first()
      .locator('xpath=following-sibling::*[1]');

    const resolved = await this.findFirstVisible([
      tabContainer.getByText(label, { exact: true }).first(),
      tabContainer.locator('div, button, a, span, p').filter({ hasText: exactRegex }).first(),
      this.page.getByRole('tab', { name: label, exact: true }).first(),
      this.page.getByRole('button', { name: label, exact: true }).first(),
      this.page.locator('main').locator('div, button, a, span, p').filter({ hasText: exactRegex }).first(),
    ]);

    if (!resolved) {
      throw new Error(`탭을 찾지 못했습니다: ${tab}`);
    }

    return resolved;
  }

  private getTabLabel(tab: OrderTabKey): string {
    switch (tab) {
      case 'all':
        return '전체';
      case 'b2c':
        return 'B2C주문';
      case 'b2b':
        return 'B2B주문';
      case 'project':
        return '프로젝트별 주문';
      default:
        return '전체';
    }
  }

  private normalize(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private isMeaningfulValue(value: string): boolean {
    const normalized = this.normalize(value);
    if (normalized.length === 0) return false;
    if (normalized === '-' || normalized === '--') return false;
    if (/^선택$|^선택안함$|^전체$|^all$/i.test(normalized)) return false;
    return true;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private inferStatusByKeyword(key: keyof typeof STATUS_FILTER_FALLBACK_INDEX, rowText: string): string {
    const candidatesByKey: Record<keyof typeof STATUS_FILTER_FALLBACK_INDEX, string[]> = {
      orderStatus: [
        '결제완료',
        '입금확인',
        '주문접수',
        '주문취소',
        '환불완료',
        '결제실패',
      ],
      paymentStatus: [
        '결제성공',
        '결제실패',
        '결제대기',
        '입금대기',
        '환불완료',
      ],
      deliveryStatus: [
        '배송전',
        '배송준비',
        '배송요청',
        '배송중',
        '배송완료',
        '출고확정',
      ],
      stockAllocationStatus: [
        '미처리',
        '할당완료',
        '부분할당',
        '할당실패',
        '재고부족',
      ],
    };

    const candidates = candidatesByKey[key] || [];
    return candidates.find((candidate) => rowText.includes(candidate)) || '';
  }

  private async findFirstVisible(candidates: Locator[]): Promise<Locator | null> {
    for (const candidate of candidates) {
      try {
        const target = candidate.first();
        if (await target.isVisible({ timeout: this.timeouts.short })) {
          return target;
        }
      } catch {
        // ignore
      }
    }
    return null;
  }
}
