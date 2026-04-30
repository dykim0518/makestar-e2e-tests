# CMR 테스트 전용 상품 운영 메모

## 가격 옵션 변동 상품

`CMR-ACTION-01`은 옵션 변경 시 총 금액이 달라지는 상품이 있어야 성립한다.
Prod Shop 기본 목록은 운영 편성에 따라 단일 옵션 상품만 노출될 수 있으므로, 테스트 전용 상품 ID를 고정값으로 주입한다.

### 상품 조건

- 판매 중인 CMR 상품
- 동일 상품 안에 선택 가능한 옵션 2개 이상
- 최소 2개 옵션의 최종 판매가가 서로 다름
- 구매/장바구니 진입 가능
- 판매 기간과 재고가 모니터링 시간대에 안정적으로 유지됨
- 상품명에 `[자동화테스트]` 또는 QA 식별 접두어 포함

### GitHub Secret

환경별로 아래 secret 중 하나를 설정한다.

- `CMR_PRICE_OPTION_PRODUCT_IDS_PROD`: Prod 상품 ID 목록
- `CMR_PRICE_OPTION_PRODUCT_IDS_STG`: STG 상품 ID 목록
- `CMR_PRICE_OPTION_PRODUCT_IDS`: 공통 fallback 상품 ID 목록

값은 쉼표 또는 공백으로 구분한다.

```text
17600,17601
```

### 동작 방식

1. 환경별 secret 상품을 먼저 직접 방문해 가격 변동을 검증한다.
2. secret이 없으면 기존처럼 Shop 목록을 스캔한다.
3. Shop 목록에도 조건 상품이 없으면 앱 실패가 아니라 `data-unavailable`로 기록하고 해당 케이스를 skip 처리한다.
4. secret이 설정된 상품에서 가격 변동을 확인하지 못하면 테스트 전용 데이터가 깨진 것으로 보고 fail 처리한다.

### 생성 주의

Prod 상품 생성은 운영 데이터 변경이므로 GitHub Hosted Runner에서 자동 생성하지 않는다.
Admin에서 상품을 만들 때는 승인된 관리자 세션과 허용 IP 환경에서 생성하고, 생성된 상품 ID만 secret에 반영한다.
