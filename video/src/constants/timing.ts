// All values are frame numbers at 30fps
export const TIMING = {
  act1: { start: 0,    end: 240  }, // 0–8s   The Hook
  act2: { start: 240,  end: 540  }, // 8–18s  The Problem
  act3: { start: 540,  end: 840  }, // 18–28s The Turn
  act4: { start: 840,  end: 1350 }, // 28–45s The Proof
  act5: { start: 1350, end: 1650 }, // 45–55s The Comparison
  act6: { start: 1650, end: 1800 }, // 55–60s The CTA
} as const;
