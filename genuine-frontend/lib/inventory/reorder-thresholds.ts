export function parseReorderThresholds(
  minimumStock: string | undefined,
  reorderLevel: string | undefined,
): { minimumStock: number; reorderLevel: number } | null {
  const minimumText = minimumStock?.trim() ?? '';
  const reorderText = reorderLevel?.trim() ?? '';
  if (!minimumText || !reorderText) return null;

  const minimum = Number(minimumText);
  const reorder = Number(reorderText);
  if (
    !Number.isInteger(minimum) ||
    !Number.isInteger(reorder) ||
    minimum < 0 ||
    reorder < minimum
  ) {
    return null;
  }

  return { minimumStock: minimum, reorderLevel: reorder };
}
