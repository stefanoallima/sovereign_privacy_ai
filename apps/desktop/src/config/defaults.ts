import type { Brand } from "./branding";

export interface BrandDefaults {
  defaultPersonaId: string;
  defaultCloudBackend: "nebius" | "normattiva";
  defaultApiEndpoint: string;
  defaultModelId: string;
  hideWizard: boolean;
  hideOllama: boolean;
  hideLocalModelSelector: boolean;
  legalDisclaimerText: string | null;
}

export const BRAND_DEFAULTS: Record<Brand, BrandDefaults> = {
  sovereign: {
    defaultPersonaId: "general-assistant",
    defaultCloudBackend: "nebius",
    defaultApiEndpoint: "",
    defaultModelId: "deepseek-ai/DeepSeek-V3",
    hideWizard: false,
    hideOllama: false,
    hideLocalModelSelector: false,
    legalDisclaimerText: null,
  },
  normattiva: {
    defaultPersonaId: "legal-advisor-it",
    defaultCloudBackend: "normattiva",
    defaultApiEndpoint: "https://api.normattiva.ai/v1",
    defaultModelId: "normattiva-legal-pro",
    hideWizard: true,
    hideOllama: true,
    hideLocalModelSelector: true,
    legalDisclaimerText:
      "Questo strumento è un ausilio alla ricerca giuridica, non sostituisce il parere di un professionista abilitato. Verifica sempre le fonti.",
  },
};
