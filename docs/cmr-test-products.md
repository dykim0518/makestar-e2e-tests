# CMR 테스트 전용 상품 운영 메모

## 가격 옵션 변동 상품

`CMR-ACTION-01`은 옵션 변경 시 총 금액이 달라지는 상품이 있어야 성립한다.
STG는 테스트 전용 상품을 직접 만들 수 있으므로 고정 상품 ID를 우선 사용한다.
Prod는 운영 상품을 직접 만들 수 없으므로 Shop 목록을 스캔해 조건에 맞는 상품을 찾는다.

### 상품 조건

- 판매 중인 CMR 상품
- 동일 상품 안에 선택 가능한 옵션 2개 이상
- 최소 2개 옵션의 최종 판매가가 서로 다름
- 구매/장바구니 진입 가능
- 판매 기간과 재고가 모니터링 시간대에 안정적으로 유지됨
- 상품명에 `[자동화테스트]` 또는 QA 식별 접두어 포함

### STG GitHub Secret

STG에만 아래 secret을 설정한다.

- `CMR_PRICE_OPTION_PRODUCT_IDS_STG`: STG 상품 ID 목록

값은 쉼표 또는 공백으로 구분한다.

```text
17600,17601
```

### 동작 방식

1. STG는 `CMR_PRICE_OPTION_PRODUCT_IDS_STG` 상품을 먼저 직접 방문해 가격 변동을 검증한다.
2. STG secret이 없으면 Shop 목록을 스캔한다.
3. Prod는 secret을 사용하지 않고 항상 Shop 목록을 스캔한다.
4. Shop 목록에도 조건 상품이 없으면 앱 실패가 아니라 `data-unavailable`로 기록하고 해당 케이스를 skip 처리한다.
5. STG secret이 설정된 상품에서 가격 변동을 확인하지 못하면 테스트 전용 데이터가 깨진 것으로 보고 fail 처리한다.

### 생성 주의

Prod 상품은 운영 데이터이므로 자동화용으로 생성하지 않는다.
STG Admin에서 상품을 만들 때는 승인된 관리자 세션과 허용 IP 환경에서 생성하고, 생성된 상품 ID만 `CMR_PRICE_OPTION_PRODUCT_IDS_STG` secret에 반영한다.
