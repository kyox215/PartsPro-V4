import assert from 'node:assert/strict';
import test from 'node:test';
import { countCatalogFilters, resetCatalogFilters, removeCatalogFilter, globalCatalogSearch } from '../src/components/partspro/catalog-filters.mjs';

test('a new global search discards a previous device scope without changing query-preserving filter reset', () => {
  const previous = {department:'phone',brand:'Samsung',model:'Galaxy A12',category:'Schermi',inStockOnly:true,sort:'name',searchQuery:'old'};
  const next = {...globalCatalogSearch('  CX08  '),sort:previous.sort};
  assert.deepEqual(next,{searchQuery:'CX08',sort:'name'});
  assert.equal(countCatalogFilters(next),0);
  assert.equal(previous.model,'Galaxy A12');
  assert.deepEqual(resetCatalogFilters({...previous,searchQuery:'CX08'}),{searchQuery:'CX08',sort:'name'});
});
test('an empty global search clears both the keyword and any previous scope', () => {
  assert.deepEqual(globalCatalogSearch('  '),{searchQuery:''});
});

test('filter badge excludes search, sort, blank strings and unchecked stock', () => {
  assert.equal(countCatalogFilters({searchQuery:'OLED',sort:'name',brand:' ',inStockOnly:false}),0);
  assert.equal(countCatalogFilters({department:'phone',brand:'Apple',model:'iPhone 13',category:'Schermi',inStockOnly:true,searchQuery:'OLED',sort:'name'}),5);
});
test('reset discards filters but preserves the current query and sorting without editing applied state', () => {
  const applied={department:'phone',brand:'Apple',model:'iPhone 13',category:'Schermi',inStockOnly:true,searchQuery:'OLED',sort:'name'};
  const draft={...applied}; const reset=resetCatalogFilters(draft);
  assert.deepEqual(reset,{searchQuery:'OLED',sort:'name'});
  assert.equal(countCatalogFilters(reset),0);
  assert.equal(draft.brand,'Apple');assert.equal(applied.model,'iPhone 13');
});
test('removing a brand also removes dependent model selections, retaining category, query and sort', () => {
  const applied={department:'phone',brand:'Apple',modelSeries:'iPhone',model:'iPhone 13',category:'Schermi',searchQuery:'OLED',sort:'updated_desc'};
  assert.deepEqual(removeCatalogFilter(applied,'brand'),{department:'phone',category:'Schermi',searchQuery:'OLED',sort:'updated_desc'});
  assert.equal(applied.model,'iPhone 13');
});
test('removing a department does not leave its brand or models active', () => {
  assert.deepEqual(removeCatalogFilter({department:'phone',brand:'Apple',modelSeries:'iPhone',model:'iPhone 13',inStockOnly:true},'department'),{inStockOnly:true});
});
test('removing one category leaves the device scope and search intact', () => {
  assert.deepEqual(removeCatalogFilter({department:'phone',brand:'Apple',model:'iPhone 13',category:'Schermi',searchQuery:'OLED'},'category'),{department:'phone',brand:'Apple',model:'iPhone 13',searchQuery:'OLED'});
});
