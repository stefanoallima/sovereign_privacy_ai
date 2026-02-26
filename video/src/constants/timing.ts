// All values are frame numbers at 30fps
export const TIMING = {
  scene1: { start: 0,    end: 150  }, // 0–5s   The Threat
  scene2: { start: 150,  end: 270  }, // 5–9s   The Turn
  scene3: { start: 270,  end: 510  }, // 9–17s  The Council
  scene4: { start: 510,  end: 870  }, // 17–29s The Pipeline
  scene5: { start: 870,  end: 1110 }, // 29–37s Data Split
  scene6: { start: 1110, end: 1350 }, // 37–45s Local Mode
  scene7: { start: 1350, end: 1500 }, // 45–50s Tech Stack
  scene8: { start: 1500, end: 1800 }, // 50–60s CTA
} as const;
