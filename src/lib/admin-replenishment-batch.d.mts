type Status="open"|"planned"|"ordered"|"received"|"ignored";
type Values={supplier:string;plannedQty:number;note:string;status:Status};
export type ReplenishmentBatchPlan=Array<{id:string;sku:string;before:Values;after:Values;patch:Partial<Values>}>;
export function buildReplenishmentBatchPlan(items: Array<{id:string;sku:string;supplier:string|null;plannedQty:number;note:string|null;status:Status}>,drafts:Record<string,{supplier:string;plannedQty:string;note:string}>,selectedIds:string[],common:{applySupplier:boolean;supplier:string;applyQty:boolean;plannedQty:string;applyNote:boolean;note:string;status:string}):ReplenishmentBatchPlan;
