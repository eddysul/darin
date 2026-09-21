# 한눈에 카테고리 오리 자산 체계

작성일: 2026-09-20
범위: 출생 후 `한눈에` 카테고리 카드·리듬 보조 일러스트. 임신 화면 자산은 별도 체계를 유지한다.

## 원칙

- 모든 그림은 같은 Darin 오리의 얼굴, 머리/몸 비율, 선 굵기, 볼·부리·발 색을 유지한다.
- 카테고리는 새 캐릭터가 아니라 행동·표정·작은 소품으로만 구분한다.
- 작은 카드에서 먼저 읽혀야 하므로 한 장면에 핵심 소품은 1개, 보조 효과는 최대 2개만 둔다.
- 투명 배경, 둥근 실루엣, 따뜻한 파스텔, 과한 그림자·텍스처·문자 삽입을 피한다.
- 기존 자산과 의미가 정확히 맞을 때만 재사용한다. 비슷해 보여도 의미가 다른 포즈는 대체하지 않는다.

## 기존 자산 inventory

| 파일 | 현재 의미/포즈 | 재사용 범위 | 판정 |
| --- | --- | --- | --- |
| `demos/assets/rhythm-duck-feed.png` | 젖병을 든 수유 오리 | 수유, 분유/유축유 | 기존 asset 사용 |
| `demos/assets/rhythm-duck-rest.png` | 누워 쉬는 오리 | 수면 | 기존 asset 사용 |
| `demos/assets/rhythm-duck-diaper.png` | 기저귀 행동 오리 | 기저귀 | 기존 asset 사용 |
| `demos/assets/rhythm-duck-sick.png` | 담요·체온계가 있는 아픈 오리 | 건강 상태, 투약/체온의 보조 이미지 | 기존 asset 사용 |
| `demos/assets/rhythm-duck-idle.png` | 앉아 있는 중립 오리 | 기타 기록, 빈/중립 상태 | 기존 asset 사용 |
| `demos/assets/growth-ai-duck-sprite.png` | 성장 AI 설명용 돋보기 동작 | AI 성장 카드 전용 | 카테고리 카드에는 사용하지 않음 |
| `demos/assets/report-weekly-duck-sprite.png` | 주간 리포트 기록/설명 동작 | 주간 리포트 전용 | 카테고리 카드에는 사용하지 않음 |
| `demos/assets/report-monthly-duck-sprite.png` | 월간 달력 동작 | 월간 리포트 전용 | 카테고리 카드에는 사용하지 않음 |
| `demos/assets/report-all-duck-sprite.png` | 전체 기록책 동작 | 전체 리포트 전용 | 카테고리 카드에는 사용하지 않음 |

## category-to-asset mapping

| 카테고리 | 매핑 | 상태 | 비고 |
| --- | --- | --- | --- |
| 수유 | `rhythm-duck-feed.png` | 기존 asset 사용 | 모유 직접 수유를 별도 묘사하지 않고 수유군 대표로 사용 |
| 수면 | `rhythm-duck-rest.png` | 기존 asset 사용 | 졸린 표정/달 요소의 신규 변형은 필수 아님 |
| 기저귀 | `rhythm-duck-diaper.png` | 기존 asset 사용 | 위생 의미가 작은 크기에서도 구분됨 |
| 건강 | `rhythm-duck-sick.png` | 기존 asset 사용 | 진단·응급 의미로 과해석하지 않는 보조 장식 |
| 투약/체온 | `rhythm-duck-sick.png` | 기존 asset 사용 | 투약 행위 자체보다 건강 기록군 대표로 사용 |
| 기타 기록 | `rhythm-duck-idle.png` | 기존 asset 사용 | 중립 포즈 |
| 터미타임 | `duck-tummy-resting.png` | 같은 스타일로 신규 제작 필요 | 단순 휴식과 구분되는 엎드린 자세 필요 |
| 이유식/식사 | `duck-meal-bowl.png` | 같은 스타일로 신규 제작 필요 | 작은 그릇+숟가락, 음식 디테일 최소화 |
| 목욕 | `duck-bath-bubbles.png` | 같은 스타일로 신규 제작 필요 | 거품 2–3개와 물방울, 욕조 전체는 생략 가능 |
| 산책 | `duck-walk-hat.png` | 같은 스타일로 신규 제작 필요 | 작은 모자 또는 외출 가방 중 하나만 사용 |
| 놀이 | `duck-play-toy.png` | 같은 스타일로 신규 제작 필요 | 둥근 딸랑이/블록 하나 |

## 신규 pose brief

1. `duck-tummy-resting`: 배를 바닥에 대고 고개를 살짝 든 측면 3/4 포즈. 힘들어 보이거나 운동 평가처럼 보이지 않게 미소는 아주 작게 유지한다.
2. `duck-meal-bowl`: 앉아서 작은 파스텔 그릇과 숟가락을 바라본다. 젖병 수유 자산과 즉시 구분되도록 한다.
3. `duck-bath-bubbles`: 몸 주변의 작은 거품과 물방울만으로 목욕을 표현한다. 젖은 털 디테일이나 욕실 배경은 넣지 않는다.
4. `duck-walk-hat`: 앉거나 한 발 내딛는 포즈에 단색 모자를 쓴다. 계절·성별을 특정하는 소품은 피한다.
5. `duck-play-toy`: 양 날개로 둥근 장난감 하나를 든다. 장난감 색은 카드 accent보다 한 단계 낮은 채도로 둔다.

## 파일명·제작 규격

- 파일명: `duck-{category}-{pose}.png`
- 예: `duck-tummy-resting.png`, `duck-bath-bubbles.png`, `duck-play-toy.png`
- master: 투명 PNG, 1:1 canvas, 최소 1024×1024 px
- safe area: 외곽 8% 이상, 발·귀·소품이 canvas에 닿지 않게 한다.
- 앱 표시: 기본 `46 × 54px` 안에서 `contain`; 카드별 임의 왜곡 금지
- 색: 오리 cream/yellow와 brown outline은 기존 자산에서 sampling하고, 소품만 카테고리 accent를 약하게 사용한다.
- 애니메이션이 필요한 경우 raster sprite를 별도 `duck-{category}-{action}-sprite.png`로 관리하며 정적 대표 프레임도 함께 둔다.

이번 G3에서는 inventory와 매핑만 확정하며 신규 이미지는 생성·교체하지 않는다.
