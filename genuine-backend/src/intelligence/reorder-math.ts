export interface ReorderMathInput {
  dailyVelocity: number;
  leadTimeDays: number;
  available: number;
  incoming: number;
  reorderLevel: number;
}

export interface ReorderMathResult {
  demandWindowUnits: number;
  safetyStockUnits: number;
  effectiveAvailable: number;
  shortfall: number;
  suggestedQuantity: number;
  daysOfStock: number | null;
  needsReorder: boolean;
  stockAnomaly: boolean;
  formula: string;
}

/**
 * Smart reorder calculation.
 * suggestedQuantity = ceil( daily*(leadTime+7) + ceil(daily*leadTime*0.5)
 *                        - max(0,available) - incoming )
 * Trigger: shortfall > 0 OR effectiveAvailable <= reorderLevel.
 */
export function computeReorderMath(input: ReorderMathInput): ReorderMathResult {
  const daily = Math.max(0, input.dailyVelocity);
  const lead = Math.max(0, input.leadTimeDays);
  const effectiveAvailable = Math.max(0, input.available);
  const incoming = Math.max(0, input.incoming);
  const demandWindowUnits = daily * (lead + 7);
  const safetyStockUnits = daily > 0 ? Math.ceil(daily * lead * 0.5) : 0;
  const shortfall = demandWindowUnits + safetyStockUnits - effectiveAvailable - incoming;
  const needsReorder = shortfall > 0 || effectiveAvailable <= input.reorderLevel;
  return {
    demandWindowUnits,
    safetyStockUnits,
    effectiveAvailable,
    shortfall,
    suggestedQuantity: Math.max(0, Math.ceil(shortfall)),
    daysOfStock: daily > 0 ? Math.floor(effectiveAvailable / daily) : null,
    needsReorder,
    stockAnomaly: input.available < 0,
    formula: 'ceil(dailyVelocity*(leadTimeDays+7) + safetyStock - max(0,available) - incomingPO)',
  };
}
