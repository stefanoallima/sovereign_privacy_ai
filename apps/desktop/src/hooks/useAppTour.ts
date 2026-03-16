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
            title: "Start a conversation",
            description:
              "Pick a persona and start chatting. Each conversation is encrypted on your device.",
            side: "bottom" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="new-incognito"]',
          popover: {
            title: "Go off the record",
            description:
              "Incognito chats vanish the moment you close them \u2014 nothing saved to disk, ever.",
            side: "bottom" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="conversations"]',
          popover: {
            title: "Your history",
            description:
              "Conversations are organized by type. Incognito chats live separately and are never written to disk.",
            side: "right" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="persona-selector"]',
          popover: {
            title: "Switch expertise",
            description:
              "Each persona (psychologist, coach, tax advisor\u2026) has its own knowledge, tone, and privacy rules.",
            side: "left" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="privacy-shield"]',
          popover: {
            title: "Store sensitive data safely",
            description:
              "Add your name, address, or tax ID here. This data is encrypted locally and auto-redacted before any cloud request.",
            side: "left" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="model-selector"]',
          popover: {
            title: "Control your privacy level",
            description:
              "Local = fully on-device. Hybrid = PII redacted, then cloud. Cloud = direct, fastest. Switch anytime.",
            side: "top" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="chat-input"]',
          popover: {
            title: "Chat & mention personas",
            description:
              "Type @ to bring other personas into the conversation. Use @all for a full council round.",
            side: "top" as const,
            align: "center" as const,
          },
        },
        {
          element: '[data-tour="privacy-badge"]',
          popover: {
            title: "See your privacy status",
            description:
              "This shows how your current message is being routed \u2014 Local, Hybrid, or Cloud.",
            side: "top" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="settings-btn"]',
          popover: {
            title: "Fine-tune everything",
            description:
              "API keys, models, privacy rules, personas. You can re-run this tour anytime from the sidebar.",
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

/**
 * First-send tour — triggered the first time the user sends a message.
 * Highlights the key controls in the chat interface.
 */
export function useFirstSendTour() {
  const { firstSendTourCompleted, setFirstSendTourCompleted } = useWizardStore();

  const startFirstSendTour = useCallback(() => {
    if (firstSendTourCompleted) return;

    const d = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: "hsl(0 0% 0% / 0.5)",
      popoverClass: "sovereign-tour-popover",
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next \u2192",
      prevBtnText: "\u2190 Back",
      doneBtnText: "Got it!",
      onDestroyed: () => setFirstSendTourCompleted(true),
      steps: [
        {
          element: '[data-tour="model-selector"]',
          popover: {
            title: "You just sent your first message!",
            description:
              "These pills control your privacy. Local = on-device only. Hybrid = PII stripped before cloud. Cloud = direct. Switch anytime.",
            side: "top" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="privacy-shield"]',
          popover: {
            title: "Add your personal details",
            description:
              "Store sensitive info here (name, address, tax ID). It\u2019s encrypted locally and auto-redacted from cloud requests.",
            side: "left" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="persona-selector"]',
          popover: {
            title: "Try different advisors",
            description:
              "Each persona has unique expertise and privacy settings. Try the Tax Advisor, Life Coach, or create your own.",
            side: "left" as const,
            align: "start" as const,
          },
        },
        {
          element: '[data-tour="chat-input"]',
          popover: {
            title: "You\u2019re all set!",
            description:
              "Type @ to mention personas in the same thread, or @all for a council round. Enjoy your sovereign AI.",
            side: "top" as const,
            align: "center" as const,
          },
        },
      ],
    });
    d.drive();
  }, [firstSendTourCompleted, setFirstSendTourCompleted]);

  return { startFirstSendTour, firstSendTourCompleted };
}
