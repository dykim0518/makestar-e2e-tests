/**
 * 테스트 계정(edqatest001@gmail.com)의 STG 의존 데이터 상수.
 *
 * 계정 상태가 바뀌면(주소 등록/삭제) 여기 ID도 갱신해야 한다. 자동화 전용 계정
 * 분리 작업이 끝나면 이 파일도 다시 잡아야 한다.
 */

export const STG_TEST_ACCOUNT = {
  /**
   * STG 마이페이지 → 배송지 관리에 등록된 "우리집" 한국 주소 ID.
   * `setDefaultShippingAddress("KR")`가 이 ID의 update 화면으로 직접 진입한다.
   * 이 주소가 삭제되면 fixture가 fail-fast.
   */
  KR_DEFAULT_ADDRESS_ID: 173397,
} as const;
