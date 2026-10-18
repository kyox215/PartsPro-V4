export function financeRound(value:number):number;
export function parseFinanceMoney(value:unknown):number|null;
export function validFinanceDate(value:unknown):boolean;
export function financeDay(value?:string):string;
export function shiftFinanceDay(value:string,days:number):string;
export function financeRomeLocalToIso(value:string):string|null;
export function financeLocalInput(value?:string):string;
export type FinanceAnalysisPoint={date:string;salesNet:number;cogsNet:number;expenseNet:number;grossProfit:number;operatingProfit:number};
export type FinanceAnalysis={trend:FinanceAnalysisPoint[];previousTrend:FinanceAnalysisPoint[];previous:FinanceAnalysisPoint;changes:Record<string,number|null>;expenses:{category:string;amountNet:number}[]};
export function buildFinanceAnalysis(rows:{type:string;date:string;amountNet:number;status:string|null;category:string|null}[],previousRows:{type:string;date:string;amountNet:number;status:string|null;category:string|null}[],dateFrom:string,dateTo:string):FinanceAnalysis;

export type FinanceTrendBucket=FinanceAnalysisPoint & {dateTo:string;previousDate:string|null;previousDateTo:string|null;previousSalesNet:number;previousCogsNet:number;previousExpenseNet:number;previousGrossProfit:number;previousOperatingProfit:number};
export type FinanceSupplierAnalysis={key:string;supplierName:string;purchaseNet:number;paidNet:number;appliedPaidNet:number;outstandingNet:number;batches:number};
export function buildFinanceDailyTrend(rows:{type:string;date:string;amountNet:number;status:string|null}[],from:string,to:string):FinanceAnalysisPoint[];
export function bucketFinanceTrend(trend:FinanceAnalysisPoint[],previousTrend:FinanceAnalysisPoint[],unit:'day'|'week'):FinanceTrendBucket[];
export function financeSupplierKey(row:{supplierId:string|null;supplierName:string|null}):string;
export function buildFinanceSupplierAnalysis(rows:{supplierId:string|null;supplierName:string|null;amountNet:number;paidNet:number;outstandingNet:number}[]):FinanceSupplierAnalysis[];
