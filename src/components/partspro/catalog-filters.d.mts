export type CatalogFilterField = 'department' | 'brand' | 'modelSeries' | 'model' | 'category' | 'inStockOnly';
export function globalCatalogSearch(query: string): { searchQuery: string };
export function readGlobalCatalogSearch(form: HTMLFormElement, field: string, invalidMessage: string): { searchQuery: string } | null;
export function countCatalogFilters(selection: Partial<Record<CatalogFilterField, unknown>>): number;
export function resetCatalogFilters<T extends {sort?: string; searchQuery?: string}>(selection: T): Pick<T, 'sort' | 'searchQuery'>;
export function removeCatalogFilter<T>(selection: T, field: CatalogFilterField): T;
