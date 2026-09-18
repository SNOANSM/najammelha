// Contributor levels. Level is driven by lifetime points earned (not the
// spendable balance) so redeeming rewards in the store never demotes anyone.

export interface Level {
  id: string;
  name: string;
  minPoints: number;
  reportPoints: number;
  resolvedBonus: number;
  perks: string[];
}

export const LEVELS: Level[] = [
  {
    id: "new",
    name: "مساهم جديد",
    minPoints: 0,
    reportPoints: 10,
    resolvedBonus: 20,
    perks: ["10 نقاط على كل بلاغ ترسله", "20 نقطة إضافية عند معالجة بلاغك", "استبدال نقاطك بخصومات المتجر"],
  },
  {
    id: "active",
    name: "مساهم نشط",
    minPoints: 500,
    reportPoints: 12,
    resolvedBonus: 25,
    perks: ["12 نقطة على كل بلاغ ترسله", "25 نقطة إضافية عند معالجة بلاغك", "كل مزايا المستوى السابق"],
  },
  {
    id: "featured",
    name: "مساهم مميز",
    minPoints: 1200,
    reportPoints: 15,
    resolvedBonus: 30,
    perks: ["15 نقطة على كل بلاغ ترسله", "30 نقطة إضافية عند معالجة بلاغك", "كل مزايا المستوى السابق"],
  },
  {
    id: "impact",
    name: "صانع أثر",
    minPoints: 1800,
    reportPoints: 20,
    resolvedBonus: 40,
    perks: ["20 نقطة على كل بلاغ ترسله", "40 نقطة إضافية عند معالجة بلاغك", "أعلى مستوى في نجمّلها"],
  },
];

export function levelFor(lifetimePoints: number): Level {
  let current = LEVELS[0];
  for (const level of LEVELS) if (lifetimePoints >= level.minPoints) current = level;
  return current;
}

/** Points needed for the next level, or 0 when already at the top. */
export function nextLevelPoints(lifetimePoints: number): number {
  const next = LEVELS.find((level) => level.minPoints > lifetimePoints);
  return next ? next.minPoints : 0;
}
