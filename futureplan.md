# Future Plan — 차별화 로드맵(멀티모달/월드 채팅) 실행 전략 요약

목표: 단순 텍스트 캐릭터 채팅을 넘어, “상황/맥락을 이해하고 장면을 만들어 보여주는” 방향으로 확장한다.

전제
- 지금은 텍스트 품질/비용 최적화가 1순위
- 멀티모달은 ‘기능 추가’가 아니라 **상태(state) 기반 시스템**을 먼저 만들어야 성공한다

---

## 1) 핵심 아이디어: Scene State(장면 상태) 기반

멀티모달 기능(image-to-image, image-to-video, 2D→3D)의 공통 기반은 “현재 장면을 구조화한 상태값”이다.

### Scene State v0(예시 JSON)
- location: 장소(실내/실외/배경 설명)
- time: 시간대/날씨
- characters: 등장인물(복장/표정/상태)
- mood: 분위기
- props: 중요한 소품/무기
- action_beats: 현재 액션 요약(1~3줄)
- camera: 구도(근접/전신/시점)
- continuity: 이전 장면과 유지해야 할 요소(색/복장/상처 등)

원칙
- 매 턴마다 전체를 다시 쓰기보다 “diff 업데이트” 형태로 유지
- 텍스트 답변과 별개로 Scene State를 생성/갱신(내부 메타데이터)

---

## 2) 단계별 실행 전략

### Stage A) 텍스트 품질을 Scene State와 연결(최소)
- LLM이 답변을 생성할 때, 동시에 Scene State를 갱신하도록(메타데이터)
- 저장 위치 후보
  - (빠른 시작) 메시지 metadata(JSON)
  - (확장) chat/session 단위 별도 테이블

성공 기준
- 긴 대화에서도 “장소/복장/상처/관계” 같은 연속성이 유지된다

### Stage B) Image-to-Image(장면 일관성 있는 이미지)
- 입력
  - base image(이전 장면 이미지)
  - scene state(텍스트 설명)
  - character reference(캐릭터 고정 요소: 얼굴/헤어/의상)
- 출력
  - next scene image + seed/params(재현 가능성)

중요 포인트
- “일관성”이 핵심이므로, 캐릭터 reference 관리(LoRA/ControlNet/ID embedding 등)가 필요
- 초기에는 API(Replicate/Hosted SD) 기반이 현실적

성공 기준
- 같은 캐릭터/장소가 대화 흐름에서 시각적으로 이어진다

### Stage C) Image-to-Video(짧은 클립)
- 입력
  - keyframes(2~3장) + scene state + motion prompt
- 출력
  - 2~6초 클립

전략
- 먼저 “전투/감정 고조” 같은 특정 상황 템플릿을 만들어 품질을 끌어올림

### Stage D) 2D → 3D(Blender/Three.js 연계)
- 현실적인 접근
  1) 2D 이미지를 “세그먼트/깊이 추정” → 간단한 parallax 2.5D
  2) 이후 필요하면 3D 재구성(비용/품질 trade-off 큼)

렌더링 전략
- 웹 클라이언트는 Three.js로 실시간 뷰(가벼운 모델/텍스처)
- 무거운 3D 생성은 서버/외부 워커로 비동기 처리

---

## 3) 제품 전략(시장 차별화 관점)

### 텍스트+비주얼 결합의 ‘상품성’ 포인트
- “대화 → 장면”이 자동으로 따라오는 UX
- 단순 이미지 생성이 아니라, “스토리/전투/관계” 같은 맥락이 반영된 장면 연출

### 비용 전략(무료/저비용 유지)
- 멀티모달은 서버 비용이 크므로
  - 기본은 텍스트 무료/저비용
  - 이미지/비디오는 크레딧 기반(유료/리워드)
  - ‘장면 상태’는 텍스트만으로도 유지 가능(저비용)

---

## 4) 지금(텍스트 단계)에서 미리 깔아둘 것
- Prompt Assembly(로어북/예시대화/메모리) 체계를 먼저 안정화
- UsageTracking/Cost 추적을 “메시지/세션”에 귀속(나중에 이미지/비디오 비용도 붙일 수 있게)
- 메시지 metadata에 scene state를 담을 수 있게 스키마/정책만 확정(구현은 Stage A에서)
