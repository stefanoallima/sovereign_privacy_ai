import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useCallback } from "react";
import { useWizardStore } from "@/stores/wizard";

export function useAppTour() {
  const { tourCompleted, setTourCompleted } = useWizardStore();

  const startTour = useCallback(() => {
    const d = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: "hsl(0 0% 0% / 0.6)",
      popoverClass: "sovereign-tour-popover",
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next \u2192",
      prevBtnText: "\u2190 Back",
      doneBtnText: "Get Started!",
      onDestroyed: () => setTourCompleted(true),
      steps: [
        {
          element: '[data-tour="new-chat"]',
          popover: {
            title: "New Chat",
            description:
              "Start a new conversation with any persona.",
            side: "bottom" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="new-incognito"]',
          popover: {
            title: "Incognito Chat",
            description:
              "Start a private conversation that won't be saved. Perfect for sensitive topics \u2014 once you close it, it's gone forever.",
            side: "bottom" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="conversations"]',
          popover: {
            title: "Your Conversations",
            description:
              "Your conversations are saved here, organized by type. Incognito chats appear separately and are never persisted to disk.",
            side: "right" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="persona-selector"]',
          popover: {
            title: "Persona Selector",
            description:
              "Switch between specialized AI personas \u2014 psychologist, life coach, career advisor, and more. Each has its own expertise and privacy settings.",
            side: "left" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="privacy-shield"]',
          popover: {
            title: "Privacy Shield",
            description:
              "Your Privacy Vault \u2014 store sensitive personal data (name, address, tax ID) that gets automatically redacted before cloud requests. Everything is encrypted locally.",
            side: "left" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="model-selector"]',
          popover: {
            title: "Privacy Mode",
            description:
              "Choose how your data is processed: Local (fully on-device), Hybrid (PII redacted locally, then sent to cloud LLM), or Cloud (direct, fastest). Each mode has a pre-configured model.",
            side: "top" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="chat-input"]',
          popover: {
            title: "Chat Input & @ Mentions",
            description:
              "Type @ to mention other personas in the same conversation. Use @all to consult your entire AI council at once.",
            side: "top" as const,
            align: "center" as const,
          },
        },
        {
          element: '[data-tour="privacy-badge"]',
          popover: {
            title: "Privacy Badge",
            description:
              "This badge shows your current privacy routing \u2014 Local, Hybrid (anonymized), or Cloud. You're always in control.",
            side: "top" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="settings-btn"]',
          popover: {
            title: "Settings",
            description:
              "Fine-tune everything \u2014 API keys, models, privacy rules, personas, and more. You can also re-run this tour from the sidebar.",
            side: "top" as const,
            align: "start" as const,
          },
        },
      ],
    });
    d.drive();
  }, [setTourCompleted]);

  return { startTour, tourCompleted };
}
