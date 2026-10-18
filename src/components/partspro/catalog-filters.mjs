const filterFields = ['department', 'brand', 'modelSeries', 'model', 'category', 'inStockOnly'];

// A new top-level search starts across the whole catalog. Sorting and the
// assisted customer identity are retained by the caller, outside filter scope.
export function globalCatalogSearch(query) {
  return { searchQuery: query.trim() };
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
