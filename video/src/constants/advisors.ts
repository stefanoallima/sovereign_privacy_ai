export type PrivacyMode = "LOCAL" | "HYBRID" | "CLOUD";

export interface Advisor {
  handle: string;
  icon: string;
  privacy: PrivacyMode;
}

export const ADVISORS: Advisor[] = [
  { handle: "@psychologist",      icon: "🧠", privacy: "CLOUD"  },
  { handle: "@life-coach",        icon: "🎯", privacy: "CLOUD"  },
  { handle: "@career-coach",      icon: "💼", privacy: "CLOUD"  },
  { handle: "@tax-navigator",     icon: "🧾", privacy: "HYBRID" },
  { handle: "@tax-audit",         icon: "📋", privacy: "HYBRID" },
  { handle: "@legal-advisor",     icon: "⚖️",  privacy: "HYBRID" },
  { handle: "@financial-advisor", icon: "💰", privacy: "HYBRID" },
  { handle: "@health-coach",      icon: "🏃", privacy: "LOCAL"  },
  { handle: "@personal-branding", icon: "✨", privacy: "CLOUD"  },
  { handle: "@social-media",      icon: "📱", privacy: "CLOUD"  },
  { handle: "@real-estate",       icon: "🏠", privacy: "HYBRID" },
  { handle: "@cybersecurity",     icon: "🛡️",  privacy: "LOCAL"  },
  { handle: "@immigration",       icon: "🌍", privacy: "HYBRID" },
  { handle: "@investment",        icon: "📈", privacy: "HYBRID" },
];
