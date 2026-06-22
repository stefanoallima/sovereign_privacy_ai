import type { Brand } from "./branding";
import type { PreferredBackend } from "@/services/backend-routing-service";

export interface BrandDefaults {
  defaultPersonaId: string;
  // The initial value for a fresh-install persona's `preferred_backend`. The
  // name is a bit of a misnomer — the type is the full PreferredBackend union
  // (including local options like "ollama") but in practice both shipped brands
  // use a cloud backend as default. A future brand that defaults to a local
  // model (e.g. a fully-offline "Field Worker" build) can use "ollama" here.
  defaultCloudBackend: PreferredBackend;
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
