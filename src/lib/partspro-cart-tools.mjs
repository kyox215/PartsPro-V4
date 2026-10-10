export function parseCartBatch(text) {
  const quantities = new Map(); const errors = [];
  const lines = String(text).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (lines.length > 100) return { items: [], errors: ['limit'] };
  lines.forEach((line, index) => {
    const match = line.match(/^([A-Za-z0-9_+.-]{3,64})[\s,;]+([1-9]\d{0,2})$/);
    if (!match) { errors.push(String(index + 1)); return; }
    const qty = (quantities.get(match[1]) ?? 0) + Number(match[2]);
    if (qty > 999) errors.push(String(index + 1)); else quantities.set(match[1], qty);
  });
  return { items: [...quantities].map(([sku, quantity]) => ({ sku, quantity })), errors };
}
// Preserve edits made after removal; restore only SKUs that are still absent.
export function restoreRemovedCartItems(current, removed) {
  const present = new Set(current.map(item => item.sku));
  return [...current, ...removed.filter(item => !present.has(item.sku)).map(({sku, quantity}) => ({sku, quantity}))];
}
