export function canSubmitCustomerRma({ selectedLine, quantityIsValid, imageCount, checkpoint }) {
  if (checkpoint?.phase === 'abandoning') return false;
  if (checkpoint?.version === 1 && checkpoint?.phase === 'active' && checkpoint?.payload) return true;
  return Boolean(selectedLine && quantityIsValid && imageCount > 0);
}
