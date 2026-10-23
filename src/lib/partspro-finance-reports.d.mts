export type FinanceReportTotals = {
  cashRefundsNet:number;cashRefundsGross:number;walletRefundsGross:number;
  salesNet:number;cogsNet:number;expenseNet:number;grossProfit:number;operatingProfit:number;operatingCostsNet:number;
  paidExpenseNet:number;pendingExpenseNet:number;cancelledExpenseNet:number;expenseCount:number;
  purchaseNet:number;supplierPaymentsNet:number;pendingSupplierPaymentsNet:number;recordedPaymentsNet:number;
  receivablesGross:number;salesOrders:number;averageOrderNet:number;
};
export type FinanceReportPeriod = FinanceReportTotals & {date:string;dateTo:string};
export type FinanceReports = {
  totals:FinanceReportTotals;previousTotals:FinanceReportTotals;changes:Record<keyof FinanceReportTotals,number|null>;
  previousRange:{dateFrom:string;dateTo:string};daily:FinanceReportPeriod[];
  expenseCategories:{category:string;amountNet:number;paidNet:number;pendingNet:number;count:number}[];
};
export function buildFinanceReports(rows:{type:string;date:string;amountNet:number;status:string|null;category:string|null;currency?:string}[],previousRows:{type:string;date:string;amountNet:number;status:string|null;category:string|null;currency?:string}[],dateFrom:string,dateTo:string):FinanceReports;
export function bucketFinanceReport(daily:FinanceReportPeriod[],unit?:'day'|'week'|'month'):FinanceReportPeriod[];
