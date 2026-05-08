# False-green Strict Patterns

## 사용법

기존 게이트는 그대로 유지한다.

```bash
npm run check:false-green
```

false-green 부채를 별도로 확인할 때만 strict 모드를 실행한다.

```bash
node scripts/check-false-green.js --strict-patterns
```

## 패턴 의미

- `console.warn` 직후 `return`: 실패 또는 미검증 상태를 경고만 남기고 테스트 성공으로 끝낼 수 있다.
- `.catch(() => {})`: 실패를 조용히 무시해 assertion까지 도달하지 못해도 녹색 처리될 수 있다.
- `.catch(() => false)`: 실패를 boolean fallback으로 바꾸어 필수 검증 실패가 조건 분기로 흡수될 수 있다.
- `expect(true).toBeTruthy()`: 실제 동작이 아닌 상수만 검증한다.
