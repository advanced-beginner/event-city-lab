# Event City Lab

실패하고 조사하며 배우는 Apache Kafka 설정 실험실입니다. 첫 화면부터
잘못된 Serializer로 메시지 발송이 실패하고, 사용자는 로그·이벤트
타임라인·SVG 물류 도시를 증거로 원인을 찾은 뒤 같은 메시지를 다시
실행해 수정 전후를 비교합니다.

## Milestone 0

- `StringSerializer`와 `OrderEvent` 불일치로 시작하는 첫 Producer 장애
- 결정론적 순수 TypeScript 엔진과 Web Worker 실행
- play, pause, step, rewind 가능한 logical-time 이벤트 기록
- 설정과 제한된 Java 코드의 양방향 동기화
- 네 단계 점진 힌트와 원인/설정/결과 연결
- SVG 기반 isometric Producer, Serializer, Broker, Message, ACK 월드
- IndexedDB 자동 저장과 검증된 JSON export/import
- reduced motion과 키보드 기반 핵심 조작
- GitHub Pages 정적 배포

## Local development

Node.js 24 LTS와 npm을 사용합니다.

```bash
nvm use
npm ci
npm run dev
```

검증 명령:

```bash
npm run typecheck
npm run test:run
npm run build
npm run test:e2e
```

브라우저 E2E는 Playwright 1.62.1과 bundled Chromium, Firefox, WebKit을
사용합니다. 최초 설치 시 `npx playwright install chromium firefox webkit`을
실행합니다. `npm run test:e2e`는 production build와 preview 서버를 사용해
세 브라우저와 `1280×720`, `1440×900`, `1920×1080` 조합을 검사합니다.

Vite의 GitHub Pages base는 `/event-city-lab/`로 설정되어 있습니다. 배포
주소는 `https://advanced-beginner.github.io/event-city-lab/`입니다. 저장소의
Settings → Pages에서 Source를 **GitHub Actions**로 한 번 선택해야 합니다.

## Architecture

- React 19 + TypeScript strict + Vite 8
- CSS Modules + inline SVG
- Zustand vanilla UI/workspace store
- Zod 4 boundary validation
- IndexedDB through `idb`
- CodeMirror 6 direct core integration
- Native module Web Worker

React UI는 Kafka 결과를 계산하지 않습니다. `src/domain/engine.ts`가
결정론적 이벤트 기록을 만들고 UI는 그 기록만 재생합니다. 상세 제품·UX
계약은 [DESIGN.md](./DESIGN.md)에 있습니다.

## Versions

- App: `0.1.0`
- Content: `2026.1`
- Kafka rule basis: `4.3.1`
- Storage schema: `1`

## License and trademark notice

Source code is MIT licensed. Original learning content and SVG are CC BY 4.0;
see [LICENSE-CONTENT.md](./LICENSE-CONTENT.md). The product name and logo are
excluded from that content license.

Apache Kafka is a trademark of The Apache Software Foundation. Event City Lab
is an independent educational simulator and is not affiliated with or endorsed
by the Apache Software Foundation.
