const filterFields = ['department', 'brand', 'modelSeries', 'model', 'category', 'inStockOnly'];

// A new top-level search starts across the whole catalog. Sorting and the
// assisted customer identity are retained by the caller, outside filter scope.
export function globalCatalogSearch(query) {
  return { searchQuery: query.trim() };
}

export function readGlobalCatalogSearch(form, field, invalidMessage) {
  const input = form.elements.namedItem(field);
  if (!input) return null;
  const selection = globalCatalogSearch(input.value);
  const length = selection.searchQuery.length;
  input.setCustomValidity(length === 0 || (length >= 2 && length <= 80) ? '' : invalidMessage);
  return input.reportValidity() ? selection : null;
}

export function countCatalogFilters(selection) {
  return filterFields.filter(key => key === 'inStockOnly'
    ? selection[key] === true
    : typeof selection[key] === 'string' && selection[key].trim().length > 0).length;
}

export function resetCatalogFilters(selection) {
  return { sort: selection.sort, searchQuery: selection.searchQuery };
}

export function removeCatalogFilter(selection, field) {
  const next = { ...selection };
  delete next[field];
  if (field === 'department') { delete next.brand; delete next.modelSeries; delete next.model; }
  if (field === 'brand') { delete next.modelSeries; delete next.model; }
  if (field === 'modelSeries') delete next.model;
  return next;
}
