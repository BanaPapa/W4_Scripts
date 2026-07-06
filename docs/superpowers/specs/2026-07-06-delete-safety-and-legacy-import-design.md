# 삭제 안전장치 + 휴지통 + 구 데이터 마이그레이션 설계

날짜: 2026-07-06

## 배경

세 가지 독립적인 작업을 함께 설계한다:

1. 프로젝트 삭제 시 확인 없이 즉시 영구 삭제되는 문제 수정
2. 실수로 삭제한 프로젝트를 복원할 수 있는 휴지통 기능 추가
3. 이전에 만든 유사한 대본 작성 앱(`C:\Dev\scripts\script`)에 남아있는 데이터를 현재 앱의 프로젝트 형태로 이관

현재 앱(`C:\Dev\scripts_new`)은 Convex 백엔드를 사용하며, `projects` 테이블에 `name`, `siteName`, `labelColor`, `favorite`, `updatedAt`, `projectMemos`, `sections`(각 section은 title/collapsed/pages 배열, 각 page는 title/script/memo/referenceLinks/tags)를 저장한다. 삭제는 `convex/projects.ts`의 `remove` mutation이 `ctx.db.delete`로 즉시 영구 삭제하며, UI(`src/App.tsx:647` `deleteProject`)는 확인창 없이 바로 호출한다.

## 1. 삭제 확인 다이얼로그

- `src/App.tsx`의 `deleteProject` 함수에서 `onDeleteProject(projectId)` 호출 전에 `window.confirm`으로 확인을 받는다. 기존 `deleteSection`(853행), `deletePageById`(910행)와 동일한 패턴.
- 메시지: `"'{project.name}' 프로젝트를 삭제하시겠습니까? 삭제된 프로젝트는 휴지통으로 이동합니다."`
- 취소 시 아무 동작도 하지 않는다.

## 2. 휴지통 (소프트 삭제 + 복원)

### 스키마 (`convex/schema.ts`)

`projects` 테이블에 `deletedAt: v.optional(v.string())` 필드를 추가한다 (ISO 문자열, 삭제 시각). 값이 없으면 활성 프로젝트, 있으면 휴지통에 있는 프로젝트다.

### Convex 함수 (`convex/projects.ts`)

- `list`: `deletedAt`이 설정되지 않은 프로젝트만 반환하도록 필터 추가.
- `listTrash` (신규 query): `deletedAt`이 설정된 프로젝트만 반환.
- `remove` (동작 변경): `ctx.db.delete(id)` 대신 `ctx.db.patch(id, { deletedAt: new Date().toISOString() })`로 소프트 삭제. 이후 "남은 활성 프로젝트가 없으면 시드 재생성" 체크는 활성 프로젝트(`deletedAt` 없음) 기준으로 판단하도록 유지.
- `restore` (신규 mutation): `args: { id: v.id("projects") }`. 해당 프로젝트의 `deletedAt` 필드를 제거(`undefined`로 patch)해서 복원.
- `permanentlyDelete` (신규 mutation): `args: { id: v.id("projects") }`. 실제 `ctx.db.delete(id)` 수행. 휴지통에 있는 항목에만 사용.
- 자동 만료 없음 — 사용자가 직접 완전 삭제하기 전까지는 휴지통에 무기한 보관.

### UI (`src/App.tsx`)

- 홈 화면 상단/헤더에 "휴지통" 작은 링크를 추가해 진입할 수 있게 한다.
- 휴지통 화면: `listTrash` 결과를 리스트로 보여주고, 각 항목에 "복원"과 "완전 삭제" 버튼을 제공.
- "완전 삭제"는 되돌릴 수 없으므로 `window.confirm`으로 한 번 더 확인.
- "복원"은 확인 없이 즉시 실행 (안전한 동작이므로).

## 3. 구 데이터 마이그레이션

### 소스 데이터

구 앱(`C:\Dev\scripts\script`)은 Firebase Realtime Database(`script-helper-9166e`, 프로젝트 개념 없이 단일 파일시스템 트리 + 스크립트 컬렉션 구조)를 사용한다. 실제 라이브 DB에서 다음을 읽어 스크래치패드에 스냅샷으로 저장했다:

- `fileSystem.json`: 18개 항목 목록 (`{id, name, type: 'script'}`), 폴더 없이 평평한 구조로 확인됨
- `scripts.json`: 각 항목 id → `{ parts: Part[], notepadContent: NotepadPanel[] }`
- `viewModes.json`: 각 항목 id → `'script' | 'notepad'` (편집 모드)

⚠️ 참고: 해당 Realtime Database는 인증 없이 읽기가 가능한 상태로 공개되어 있었다. 마이그레이션 범위는 아니지만, 이후 구 프로젝트를 정리/폐기할 때 고려할 사항.

### 변환 규칙 (18개 항목 → 18개 Project)

각 fileSystem 항목을 새 앱의 Project 1개로 변환한다:

- **name / siteName**: 원래 이름이 `/^스크립트 \d+$/` 패턴(자동생성)이면, 해당 항목 내용에서 첫 실제 텍스트를 추출해 이름으로 사용한다 — script 모드는 첫 cut의 subject(없으면 text), notepad 모드는 첫 non-empty 줄(HTML 태그 제거 후). 추출한 문자열은 30자 내외로 자르고, 아무 것도 못 찾으면 원래 자동생성 이름을 그대로 둔다. 이미 의미있는 이름(자동생성 패턴이 아닌 경우, 예: "진주 평거센트럴")은 그대로 사용.
- **labelColor**: 전부 `"blue"` 고정값 (구 데이터에 대응 개념 없음).
- **favorite**: `false`
- **updatedAt**: 항목 id는 `script-{timestampMs}-{random}` 형식이므로, 이 timestamp를 파싱해 ISO 문자열로 사용. 파싱 실패 시 마이그레이션 실행 시각으로 대체.
- **projectMemos**: `{ qa: "", caution: "", feedback: "" }` (구 데이터에 대응 개념 없음)
- **sections**:
  - **script 모드**: 각 `Part` → `ScriptSection`(`title = part.title`, `collapsed = false`). 각 `Cut` → `ScriptPage`:
    - `title = cut.subject || "컷 {n}"`
    - `script = cut.text || ""`
    - `memo`: `planningNotes`/`designNotes` 중 값이 있는 것만 `[기획] ...`, `[디자인] ...` 라벨을 붙여 줄바꿈으로 결합. 둘 다 없으면 빈 문자열.
    - `referenceLinks: []`, `tags: []`
    - `cut.duration`, `cut.actions`는 마이그레이션하지 않음 (새 스키마에 대응 필드 없음, 데이터 손실 감수하기로 확인됨)
  - **notepad 모드**: `ScriptSection` 1개(`title = "메모"`)에 `ScriptPage` 1개:
    - `title`: 프로젝트 이름과 동일
    - `script`: 모든 `notepadContent` 패널의 HTML을 플레인텍스트로 변환(태그 제거, `<div>`/`<br>` → 줄바꿈) 후 `\n\n---\n\n` 구분자로 이어붙임
    - `memo = ""`, `referenceLinks: []`, `tags: []`

### 실행 방식

1회성 Node 변환 스크립트를 작성해 스냅샷 JSON을 읽고 위 규칙대로 변환한다. 실제 DB에 반영하기 전에 18개 프로젝트의 이름/모드/섹션수/페이지수 요약을 사람이 읽을 수 있는 형태로 출력해 검토받는다. 승인 후 `npx convex import --table projects --append <생성된 jsonl 파일>` 형태로 기존 프로젝트를 건드리지 않고 추가한다 (정확한 CLI 플래그는 구현 시 `npx convex import --help`로 확인).

## 테스트 계획

- 확인 다이얼로그: 취소 시 프로젝트가 남아있는지, 확인 시 휴지통으로 이동하는지 수동 확인
- 휴지통: 삭제 → 목록에서 사라짐 → 휴지통에 나타남 → 복원 → 다시 목록에 나타나는지 확인. 완전 삭제 후 휴지통/목록 어디에도 없는지 확인
- 마이그레이션: 변환 스크립트의 요약 출력을 사람이 직접 검토(자동 테스트 대상 아님, 1회성 데이터 작업). import 후 Convex 대시보드 또는 앱 UI에서 18개 프로젝트가 보이는지, 대표로 몇 개(특히 "진주 평거센트럴" 쌍)의 내용이 원본과 일치하는지 샘플 확인
