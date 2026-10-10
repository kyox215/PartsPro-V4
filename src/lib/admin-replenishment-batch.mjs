export function buildReplenishmentBatchPlan(items, drafts, selectedIds, common) {
 if (!selectedIds.length || selectedIds.length>50 || new Set(selectedIds).size!==selectedIds.length) throw Error('INVALID_SELECTION');
 const byId=new Map(items.map(item=>[item.id,item]));
 return selectedIds.map(id=>{
  const item=byId.get(id);if(!item)throw Error('STALE_SELECTION');
  const draft=drafts[id]??{supplier:item.supplier??'',plannedQty:String(item.plannedQty),note:item.note??''};
  const supplier=(common.applySupplier?common.supplier:draft.supplier).trim(),note=(common.applyNote?common.note:draft.note).trim(),quantity=(common.applyQty?common.plannedQty:draft.plannedQty).trim();
  if(supplier.length>100||note.length>500||!/^\d+$/.test(quantity)||Number(quantity)>99999)throw Error('INVALID_BATCH_FIELDS');
  const status=common.status||item.status;if(!['open','planned','ordered','received','ignored'].includes(status))throw Error('INVALID_STATUS');
  const patch={};if(supplier!==(item.supplier??''))patch.supplier=supplier;if(note!==(item.note??''))patch.note=note;if(Number(quantity)!==item.plannedQty)patch.plannedQty=Number(quantity);if(status!==item.status)patch.status=status;
  return{id,sku:item.sku,before:{supplier:item.supplier??'',plannedQty:item.plannedQty,note:item.note??'',status:item.status},after:{supplier,plannedQty:Number(quantity),note,status},patch};
 }).filter(row=>Object.keys(row.patch).length);
}
