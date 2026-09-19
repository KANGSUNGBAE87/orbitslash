# CMM 대안 조사 및 agy 3.8 Flash 실행 확인

- Date: 2026-09-19
- Actor: codex
- Worker: Antigravity CLI, `gemini-3.8-flash-high`, effort `high`
- Status: 잠정 조사. 도구 도입이나 설정 변경 결정 없음.

## 사용자 요청

서브에이전트 목록과 agy 인증을 확인하고 Gemini 3.8 Flash High에 Google 검색으로 CMM보다 나은 코드 관리/탐색 방법을 조사하도록 요청. 업데이트된 agy에서 모델 목록을 재확인하도록 후속 지시.

## 실행 및 검증

- 실행 경로: `/Users/kangsungbae/.local/bin/agy`.
- 업데이트 후 `agy models`가 `gemini-3.8-flash-high` / `Gemini 3.8 Flash (High)`를 반환.
- 상태 전용 `check-antigravity-auth.sh`: `ok: Antigravity CLI auth`, exit 0.
- 실행 옵션: `--model gemini-3.8-flash-high --effort high --mode plan --output-format stream-json`.
- agy conversation: `a35fd168-ae9f-4ce9-a87b-d348e3228bf0`.
- 실행 init 이벤트에서 요청 모델 사용 확인. `search_web` 8회 완료 이벤트 확인.
- 검색 주제: CMM 릴리즈/자동 갱신, Serena, CodeGraphContext/GitNexus, Augment Context Engine, Sourcegraph MCP.
- `read_url_content(github.com)`는 headless 권한 확인 불가로 자동 거부. 권한 변경/우회 없이 동일 대화에 추가 도구 사용 금지, 기존 검색 결과로만 답변하도록 요청.
- 후속 실행은 exit 0, 비어 있지 않은 최종 답변 수신. 첫 실행의 `SUCCESS`/exit 0만으로 조사가 완료됐다고 판단하지 않음.
- 검색 제공자가 Google인지는 agy 도구 인터페이스에서 확인 불가. Google 검색 수행을 확정하지 않음.

## 조사 결론과 근거 수준

| 선택 | 판단 | 한계/비용 |
| --- | --- | --- |
| CMM 유지 및 실제 연결 경로 정비 | 우선 검토. 기존 인덱스 검색은 정상이고 전역/프로젝트 경로 불일치는 직접 확인된 문제 | 변경 반영 여부 재현 검증 필요. 아직 수정/갱신/업데이트하지 않음 |
| Serena 보완 실험 | LSP 기반 심볼 탐색·편집이 필요한 경우 후보 | 언어 서버 운영 및 도구 중복 비용. 실제 TS 저장소 비교 없이 CMM보다 정확하다고 단정 불가 |
| GitNexus / CodeGraphContext / Augment / Sourcegraph | 추가 비교 후보 | agy가 검색 결과만 확인. 가격, 배포 방식, 코드 전송 경계, 성능은 도입 전 공식 원문 확인 필요 |

에이전트 결과의 오류/과장은 다음과 같이 걸러냄:

- agy의 최신 CMM `v0.10.x` 언급은 채택하지 않음. Codex가 권한 거부 발생 전에 직접 연 공식 latest 페이지는 `v0.11.0`으로 연결됨.
- CMM을 순수 AST 도구로 단순화하거나 타입 추론이 없다고 단정하지 않음. 앞선 공식 v0.8.1 문서에서 Hybrid LSP 지원을 확인한 상태.
- Serena의 정확도가 항상 우월하다는 주장, 도입 비용이 설정 한 줄뿐이라는 주장은 미검증.
- 로컬 인덱싱이 곧 코드의 외부 전송이 전혀 없다는 의미는 아님. MCP 반환 코드가 외부 LLM 컨텍스트로 전달될 수 있으며, 도구 자체 처리와 에이전트 처리를 구분해야 함.
- 모든 프로젝트를 전역 캐시 하나로 옮긴다는 제안은 채택하지 않음. 기존 프로젝트별 인덱스 원칙과 새 버전의 캐시/데몬 정책을 먼저 대조해야 함.
- agy 요약의 검색 6회 표기는 실행 이벤트 8회로 정정.

## 출처

Codex가 직접 연 원문(agy 권한 거부 이전):

- CMM 최신 릴리즈: https://github.com/DeusData/codebase-memory-mcp/releases/tag/v0.11.0
- Serena 공식 문서: https://github.com/oraios/serena

agy 검색에서 제시한 후보 출처(원문 확인 미완료):

- https://github.com/CodeGraphContext/CodeGraphContext
- https://github.com/abhigyanpatwari/GitNexus
- Sourcegraph 및 Augment 공식 자료는 정확한 기능/요금 문서 확인이 추가로 필요.

## 변경 및 다음 단계

- 변경 파일: 이 세션 기록만 생성. 앱 코드, MCP 설정, 권한, 라우팅, 설치 버전은 변경하지 않음.
- 다음 단계 후보: 현재 CMM 연결 경로/자동 갱신 검증 → 버전별 호환성 검토 → 필요하면 별도 승인 후 Serena를 같은 TypeScript 과제로 비교.
- 지식저장소 승격: 없음. 잠정 조사이며 채택 결정 없음.
- Graphify/UA: 코드·아키텍처·운영 규칙 변경 없는 조사 기록이므로 갱신 생략.
