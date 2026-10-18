import assert from 'node:assert/strict';
import test from 'node:test';
import { countCatalogFilters, resetCatalogFilters, removeCatalogFilter, globalCatalogSearch, readGlobalCatalogSearch } from '../src/components/partspro/catalog-filters.mjs';

test('search validation matches the API length limits after trimming and permits clearing a query', () => {
  for (const [value,valid] of [['  X  ',false],['数',false],['数据线',true],['X'.repeat(80),true],['X'.repeat(81),false],[' ',true]]) {
    const input={value,message:'',setCustomValidity(message){this.message=message;},reportValidity(){return !this.message;}};
    const form={elements:{namedItem:()=>input}};
    const result=readGlobalCatalogSearch(form,'q','Length invalid');
    assert.equal(result !== null,valid,value);
    if (valid) assert.deepEqual(result,{searchQuery:value.trim()});
    else assert.equal(input.message,'Length invalid');
  }
});
test('the same search input can recover from an invalid value and clear its search', () => {
  const input={value:'X',message:'',setCustomValidity(message){this.message=message;},reportValidity(){return !this.message;}};
  const form={elements:{namedItem:()=>input}};
  assert.equal(readGlobalCatalogSearch(form,'q','Length invalid'),null);
  input.value='CX08';
  assert.deepEqual(readGlobalCatalogSearch(form,'q','Length invalid'),{searchQuery:'CX08'});
  assert.equal(input.message,'');
  input.value=' ';
  assert.deepEqual(readGlobalCatalogSearch(form,'q','Length invalid'),{searchQuery:''});
});

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
