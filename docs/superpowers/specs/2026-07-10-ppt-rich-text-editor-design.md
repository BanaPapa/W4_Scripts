# PPT 스타일 리치 텍스트 에디터 설계

날짜: 2026-07-10
상태: 승인됨

## 배경

노트/메모 편집 툴바가 `document.execCommand` 기반으로 구현되어 있어 적용 동작이 불안정하고,
도구 종류·색상 팔레트·글자 크기 방식이 PPT(파워포인트) 홈 리본과 다르다.
목표: 글꼴+단락 그룹 전체를 PPT와 동일한 UI/동작으로 재구축.

## 결정

- 엔진: **TipTap v3** (ProseMirror 기반, MIT)
- 저장 형식: 기존 `__PT_RICH_TEXT_V1__` + HTML 유지 → 데이터 마이그레이션 불필요
- 기존 `RichTextEditor`(App.tsx 내부) 삭제, `src/editor/` 모듈로 교체
- 사용처 2곳(노트 원고, 메모 분할 컬럼)의 props 인터페이스(value/onChange/className/ariaLabel) 유지

## 파일 구성

```
src/editor/
  RichTextEditor.tsx   — TipTap 에디터 본체, 값 동기화, F4 반복, 단축키
  Toolbar.tsx          — PPT 홈 리본 스타일 툴바, 선택 영역 기준 활성 상태
  ColorPicker.tsx      — 분할버튼 + 팔레트(테마색 10×5, 표준색, 최근 색, 기타 색)
  FontControls.tsx     — 글꼴 드롭다운, 크기 콤보(직접입력+프리셋), A↑/A↓
  extensions.ts        — 확장 설정 + 커스텀 들여쓰기/줄간격 확장
  constants.ts         — 글꼴 목록, PPT 크기 단계, 팔레트 색상표
```

## 도구 구성

글꼴 그룹: 글꼴 드롭다운(맑은 고딕, 나눔고딕, 굴림, 돋움, 바탕, Arial, Times New Roman 등),
크기 콤보(PPT 프리셋 8~96), A↑/A↓(PPT 단계 증감, Ctrl+Shift+>/<), B/I/U/취소선,
서식 지우기, 형광펜·글자색 분할버튼+팔레트(형광펜 없음 포함).

단락 그룹: 글머리 기호/번호 매기기(Tab/Shift+Tab 수준 조절), 들여쓰기 늘리기/줄이기(단락에도 적용),
줄 간격(1.0/1.15/1.5/2.0/2.5/3.0), 정렬 4종(왼쪽/가운데/오른쪽/양쪽).

## 핵심 동작

- 선택 영역에만 적용, 선택 없으면 이후 입력부터 적용 (PPT 동일)
- 툴바 활성 상태가 커서 위치의 서식을 실시간 반영
- TipTap 히스토리 기반 Ctrl+Z/Ctrl+Y
- F4 마지막 서식 작업 반복 유지

## 데이터 흐름

TipTap `onUpdate` → `encodeRichText(getHTML())` → 기존 onChange.
외부 value 변경(페이지 전환) 시 `setContent`로 동기화, 자기 자신이 발생시킨 변경은 skip.
기존 HTML(font 태그, 인라인 스타일)은 TipTap 파서가 표준 형태로 정규화.

## 테스트

- constants의 크기 단계 함수 단위 테스트
- 커스텀 들여쓰기/줄간격 확장 로직 테스트
- richText.ts 기존 HTML 호환 왕복 테스트

## 의존성

`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-text-style`,
`@tiptap/extension-text-align`, `@tiptap/extension-highlight`
