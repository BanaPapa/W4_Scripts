import type { Project } from "./types";

// Seed folders are all plain script folders at the top level; the classification
// fields (kind/order/parentId/memoText) and the emoji are filled in with
// defaults on read (mapProjectDoc), so seeds omit them.
type SeedProject = Omit<Project, "id" | "kind" | "order" | "parentId" | "memoText" | "emoji"> & { id: string };

export const seedProjects: SeedProject[] = [
  {
    id: "north-port",
    name: "북항 복합업무지구 제안 발표",
    siteName: "부산 북항 2단계 사업지",
    labelColor: "green",
    favorite: true,
    updatedAt: new Date().toISOString(),
    projectMemos: {
      qa:
        "Q. 북항 사업지의 초기 유입을 어떻게 검증할 수 있나요?\nA. 경쟁 사업지 대비 도보 동선, 업무 수요, 문화 시설 접근성을 같은 기준으로 비교해 설명합니다.\n\nQ. 일정 리스크가 생겼을 때 우선순위는 무엇인가요?\nA. 인허가 일정, 임차 수요 확인, 운영 파트너 확정 순서로 관리한다고 답변합니다.",
      caution:
        "금액, 면적, 일정은 최종 제안서 수치와 반드시 맞춥니다.\n\n강조 표현은 줄이고 의사결정자가 확인할 수 있는 근거 중심으로 말합니다.",
      feedback:
        "1회차 발표 연습: 도입부가 길어져 P.1을 40초 안으로 줄입니다.\n\n2회차 발표 연습: P.7 비교 설명은 좋아졌지만 결론 문장을 먼저 말하면 더 명확합니다."
    },
    sections: [
      {
        id: "intro",
        title: "Introduction",
        collapsed: false,
        pages: [
          {
            id: "p1",
            title: "오프닝과 발표 목표",
            script:
              "안녕하세요. 오늘은 북항 복합업무지구 제안의 핵심 방향과 실행 계획을 말씀드리겠습니다.\n\n이번 발표의 목표는 세 가지입니다. 첫째, 사업지의 수요 근거를 짧고 분명하게 공유합니다. 둘째, 경쟁 사업지 대비 차별화되는 운영 전략을 설명합니다. 셋째, 의사결정자가 바로 검토할 수 있도록 일정과 리스크 대응안을 정리합니다.",
            memo: "도입부는 40초 안에 마무리. 심사위원이 사업지 배경을 이미 알고 있다는 전제로 짧게 진행.",
            referenceLinks: ["https://www.busan.go.kr"],
            tags: ["도입", "발표목표"]
          },
          {
            id: "p2",
            title: "사업지 한 줄 요약",
            script:
              "북항 2단계 사업지는 업무, 상업, 문화 동선이 만나는 지점입니다. 제안의 핵심은 초기 유입을 빠르게 만들고 장기 운영 안정성을 확보하는 데 있습니다.",
            memo: "",
            referenceLinks: [],
            tags: ["사업지", "요약"]
          },
          {
            id: "p3",
            title: "발표 흐름 안내",
            script:
              "발표는 입지와 수요, 경쟁 사업지 비교, 제안 전략, 실행 일정 순서로 진행하겠습니다. 각 파트는 의사결정에 필요한 근거 위주로 짧게 말씀드리겠습니다.",
            memo: "목차를 읽는 느낌보다 판단 순서를 안내하는 톤.",
            referenceLinks: [],
            tags: ["목차", "흐름"]
          }
        ]
      },
      {
        id: "overview",
        title: "Business Overview",
        collapsed: false,
        pages: [
          {
            id: "p4",
            title: "입지와 수요 근거",
            script:
              "북항 2단계 사업지는 업무 수요와 문화 동선이 동시에 만나는 입지입니다. 이 장에서는 왜 지금 이 제안이 필요한지, 수요와 접근성 중심으로 설명하겠습니다.",
            memo: "지도 설명은 길게 하지 말고 수요 근거 2개만.",
            referenceLinks: [],
            tags: ["입지", "수요"]
          },
          {
            id: "p5",
            title: "경쟁 사업지 비교",
            script:
              "경쟁 사업지와 비교했을 때 북항의 강점은 복합 동선과 초기 콘텐츠 구성입니다. 단순 면적 비교보다 유입 흐름과 운영 가능성의 차이를 중심으로 보겠습니다.",
            memo: "표 전체를 읽지 말고 차이가 큰 항목 2개만 짚기.",
            referenceLinks: [],
            tags: ["경쟁", "비교"]
          }
        ]
      },
      {
        id: "strategy",
        title: "Strategy",
        collapsed: false,
        pages: [
          {
            id: "p6",
            title: "제안 전략 핵심",
            script:
              "핵심 전략은 초기 유입을 빠르게 만들고, 운영 리스크를 단계별로 줄이는 것입니다. 심사위원이 바로 판단할 수 있도록 실행 순서와 책임 지점을 함께 말씀드리겠습니다.",
            memo: "",
            referenceLinks: [],
            tags: ["전략", "실행"]
          },
          {
            id: "p7",
            title: "리스크 대응 시나리오",
            script:
              "일정 지연과 초기 임차 수요 부족은 가장 현실적인 리스크입니다. 먼저 리스크를 인정하고, 인허가 일정 관리, 수요 사전 확인, 운영 파트너 확정 순서로 대응하겠습니다.",
            memo: "리스크를 숨기지 않고 먼저 인정하는 톤.",
            referenceLinks: [],
            tags: ["리스크", "대응"]
          }
        ]
      }
    ]
  },
  {
    id: "gangnam",
    name: "강남 업무시설 리뉴얼",
    siteName: "테헤란로 역세권",
    labelColor: "blue",
    favorite: false,
    updatedAt: "2026-07-03T10:10:00.000Z",
    projectMemos: { qa: "", caution: "", feedback: "" },
    sections: [
      {
        id: "gangnam-intro",
        title: "Opening",
        collapsed: false,
        pages: [
          {
            id: "g1",
            title: "리뉴얼 필요성",
            script: "테헤란로 업무시설의 리뉴얼 방향과 임차 경쟁력 회복 방안을 설명합니다.",
            memo: "",
            referenceLinks: [],
            tags: ["리뉴얼"]
          }
        ]
      }
    ]
  },
  {
    id: "pangyo",
    name: "판교 지식산업센터 임대 제안",
    siteName: "분당 판교권역",
    labelColor: "orange",
    favorite: false,
    updatedAt: "2026-06-29T08:30:00.000Z",
    projectMemos: { qa: "", caution: "", feedback: "" },
    sections: [
      {
        id: "pangyo-intro",
        title: "Summary",
        collapsed: false,
        pages: [
          {
            id: "pg1",
            title: "임대 전략 요약",
            script: "판교권역 임대 수요와 차별화 포인트를 중심으로 제안의 전체 방향을 소개합니다.",
            memo: "",
            referenceLinks: [],
            tags: ["임대", "전략"]
          }
        ]
      }
    ]
  }
];
