import type { AppLanguage } from "./detect-user-language";

export interface OnboardingCopy {
  readonly welcomeTitle: string;
  readonly welcomeBody: string;
  readonly howItWorksTitle: string;
  readonly howItWorksBody: string;
  readonly howItWorksSteps: readonly string[];
  readonly firstClaimTitle: string;
  readonly firstClaimBody: string;
  readonly createClaim: string;
  readonly exploreFirst: string;
  readonly back: string;
  readonly next: string;
  readonly done: string;
  readonly firstClaimLiveTitle: string;
  readonly firstClaimLiveBody: string;
  readonly shareIt: string;
}

// Static UI copy mirrors constants/onboardingStrings.ts in the Expo app.
// Claim translation remains a separate feature and is never used here.
export const onboardingStrings: Record<AppLanguage, OnboardingCopy> = {
  en: {
    welcomeTitle: "Welcome to FactFight",
    welcomeBody: "Doubt something is fake or true? Post it — and you'll see the evidence.",
    howItWorksTitle: "Here's how it works",
    howItWorksBody: "Bring one checkable claim and let the community investigate it together.",
    howItWorksSteps: ["Pick a claim", "Add evidence and a source", "The community votes", "A verdict appears"],
    firstClaimTitle: "Post your first claim",
    firstClaimBody: "Share one claim for the community to review.",
    createClaim: "Create claim",
    exploreFirst: "Explore first",
    back: "Back",
    next: "Next",
    done: "Done",
    firstClaimLiveTitle: "🎉 Your first claim is live!",
    firstClaimLiveBody: "The community will vote, and you'll see the evidence and verdict. Welcome to FactFight.",
    shareIt: "Share it",
  },
  vi: {
    welcomeTitle: "Chào mừng đến với FactFight",
    welcomeBody: "Nghi ngờ điều gì là giả hay thật? Hãy đăng lên — bạn sẽ thấy bằng chứng.",
    howItWorksTitle: "Cách hoạt động",
    howItWorksBody: "Đưa ra một tuyên bố có thể kiểm chứng để cộng đồng cùng tìm hiểu.",
    howItWorksSteps: ["Chọn một tuyên bố", "Thêm bằng chứng và nguồn", "Cộng đồng bỏ phiếu", "Kết luận được công bố"],
    firstClaimTitle: "Đăng tuyên bố đầu tiên",
    firstClaimBody: "Chia sẻ một tuyên bố để cộng đồng cùng xem xét.",
    createClaim: "Tạo tuyên bố",
    exploreFirst: "Khám phá trước",
    back: "Quay lại",
    next: "Tiếp theo",
    done: "Xong",
    firstClaimLiveTitle: "🎉 Tuyên bố đầu tiên của bạn đã được đăng!",
    firstClaimLiveBody: "Cộng đồng sẽ bỏ phiếu và bạn sẽ thấy bằng chứng cùng kết luận. Chào mừng đến với FactFight.",
    shareIt: "Chia sẻ",
  },
  zh: {
    welcomeTitle: "欢迎来到 FactFight",
    welcomeBody: "怀疑某件事是真是假？发布它——一起看看证据。",
    howItWorksTitle: "了解运作方式",
    howItWorksBody: "提出一个可以核实的说法，让社区一起调查。",
    howItWorksSteps: ["选择一个说法", "添加证据和来源", "社区进行投票", "公布结论"],
    firstClaimTitle: "发布你的第一个说法",
    firstClaimBody: "分享一个说法，邀请社区一起核实。",
    createClaim: "创建说法",
    exploreFirst: "先去看看",
    back: "返回",
    next: "下一步",
    done: "完成",
    firstClaimLiveTitle: "🎉 你的第一个说法已发布！",
    firstClaimLiveBody: "社区会进行投票，你将看到证据和结论。欢迎来到 FactFight。",
    shareIt: "分享",
  },
  es: {
    welcomeTitle: "Bienvenido a FactFight",
    welcomeBody: "¿Dudas si algo es falso o verdadero? Publícalo y verás las pruebas.",
    howItWorksTitle: "Así funciona",
    howItWorksBody: "Comparte una afirmación comprobable para que la comunidad la investigue.",
    howItWorksSteps: ["Elige una afirmación", "Añade pruebas y una fuente", "La comunidad vota", "Aparece un veredicto"],
    firstClaimTitle: "Publica tu primera afirmación",
    firstClaimBody: "Comparte una afirmación para que la comunidad la revise.",
    createClaim: "Crear afirmación",
    exploreFirst: "Explorar primero",
    back: "Atrás",
    next: "Siguiente",
    done: "Listo",
    firstClaimLiveTitle: "🎉 ¡Tu primera afirmación ya está publicada!",
    firstClaimLiveBody: "La comunidad votará y podrás ver las pruebas y el veredicto. Bienvenido a FactFight.",
    shareIt: "Compartir",
  },
};
