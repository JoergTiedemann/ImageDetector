export function countBerryArrayByClass(bboxResults) {
  const classMap = new Map();
  let total = 0;

  for (const berry of bboxResults) {
    const idx = berry.class_idx;
    classMap.set(idx, (classMap.get(idx) || 0) + 1);
    total++;
  }

  return {
    classMap,
    total,
  };
}
