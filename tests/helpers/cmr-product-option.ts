import { expect } from "@playwright/test";
import { MakestarPage } from "../pages/makestar.page";

export type OptionPriceVerificationResult = {
  optionCandidateFound: boolean;
  priceChanged: boolean;
  detail: string;
};

export async function verifyCurrentProductOptionPriceChange(
  makestar: MakestarPage,
  label: string,
): Promise<OptionPriceVerificationResult> {
  const optionUiReady = await makestar.ensureOptionSelectionVisible();
  if (!optionUiReady) {
    return {
      optionCandidateFound: false,
      priceChanged: false,
      detail: `${label}: 옵션 선택 UI를 표시하지 못했습니다.`,
    };
  }

  const hasPrice = await makestar.verifyPriceInfo();
  if (!hasPrice) {
    return {
      optionCandidateFound: false,
      priceChanged: false,
      detail: `${label}: 가격 정보가 표시되지 않습니다.`,
    };
  }

  const initialPrice = await makestar.getCurrentPrice();
  const options = await makestar.getOptionList();
  console.log(`   ${label}: 초기 가격 ${initialPrice || "확인 불가"}`);
  console.log(`   ${label}: 옵션 개수 ${options.length}개`);

  if (initialPrice === null) {
    return {
      optionCandidateFound: false,
      priceChanged: false,
      detail: `${label}: 초기 가격을 읽을 수 없습니다.`,
    };
  }

  if (options.length <= 1) {
    return {
      optionCandidateFound: false,
      priceChanged: false,
      detail: `${label}: 가격 변동 검증에 필요한 옵션이 2개 미만입니다.`,
    };
  }

  for (let optionIndex = 1; optionIndex < options.length; optionIndex++) {
    const optionSelected = await makestar.selectOptionByIndex(optionIndex);
    expect(
      optionSelected,
      `${label}의 옵션 ${optionIndex + 1} 선택에 실패했습니다.`,
    ).toBe(true);

    await makestar.waitForContentStable();
    const changedPrice = await makestar.getCurrentPrice();
    console.log(
      `   ${label} 옵션 ${optionIndex + 1} 가격: ${changedPrice || "확인 불가"}`,
    );

    if (changedPrice === null) {
      continue;
    }

    if (changedPrice !== initialPrice) {
      return {
        optionCandidateFound: true,
        priceChanged: true,
        detail: `${label}: ${initialPrice} -> ${changedPrice}`,
      };
    }
  }

  return {
    optionCandidateFound: true,
    priceChanged: false,
    detail: `${label}: 옵션은 2개 이상이지만 가격 변동이 없습니다.`,
  };
}
