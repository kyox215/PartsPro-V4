import { financeDay, financeRound, shiftFinanceDay, validFinanceDate } from './partspro-finance-core.mjs';

const additive = ['salesNet', 'cogsNet', 'expenseNet', 'paidExpenseNet', 'pendingExpenseNet', 'cancelledExpenseNet', 'purchaseNet', 'supplierPaymentsNet', 'pendingSupplierPaymentsNet', 'receivablesGross', 'salesOrders', 'expenseCount'];
const empty = () => Object.fromEntries(additive.map(key => [key, 0]));
const add = (target, key, value) => { target[key] = financeRound(target[key] + value); };
function finish(total) {
  return { ...total, grossProfit: financeRound(total.salesNet - total.cogsNet), operatingCostsNet: financeRound(total.cogsNet + total.expenseNet), operatingProfit: financeRound(total.salesNet - total.cogsNet - total.expenseNet), recordedPaymentsNet: financeRound(total.paidExpenseNet + total.supplierPaymentsNet), averageOrderNet: total.salesOrders ? financeRound(total.salesNet / total.salesOrders) : 0 };
}
function increment(total, row) {
  const amount = row.amountNet;
  if (row.type === 'expense') {
    if (row.status === 'cancelled') add(total, 'cancelledExpenseNet', amount);
    else { add(total, 'expenseNet', amount); add(total, row.status === 'paid' ? 'paidExpenseNet' : 'pendingExpenseNet', amount); total.expenseCount++; }
  } else if (row.type === 'supplier_payment') {
    if (row.status === 'paid') add(total, 'supplierPaymentsNet', amount);
    else if (row.status !== 'cancelled') add(total, 'pendingSupplierPaymentsNet', amount);
  } else {
    const key = { sale: 'salesNet', cogs: 'cogsNet', purchase: 'purchaseNet', receivable: 'receivablesGross' }[row.type];
    if (key) add(total, key, amount);
    if (row.type === 'sale') total.salesOrders++;
  }
}

// Amounts follow the existing ledger's date and recognition contracts. These are
// net operating reports, never a bank balance or an inferred cash-flow statement.
export function buildFinanceReports(rows, previousRows, dateFrom, dateTo) {
  const days = Math.round((Date.parse(dateTo) - Date.parse(dateFrom)) / 86400000) + 1;
  if (!validFinanceDate(dateFrom) || !validFinanceDate(dateTo) || days < 1 || days > 366) throw new Error('Choose a report range of 1 to 366 days.');
  const previousTo = shiftFinanceDay(dateFrom, -1), previousFrom = shiftFinanceDay(dateFrom, -days);
  const daily = new Map(), categories = new Map(), current = empty(), previous = empty();
  for (let date = dateFrom; date <= dateTo; date = shiftFinanceDay(date, 1)) daily.set(date, empty());
  function collect(source, from, to, target, isCurrent) {
    for (const row of source) {
      const date = financeDay(row.date);
      if (date < from || date > to || !date) continue;
      if (!Number.isFinite(row.amountNet) || row.currency && row.currency.toUpperCase() !== 'EUR') throw new Error('Report entries require finite EUR amounts.');
      increment(target, row);
      if (!isCurrent) continue;
      increment(daily.get(date), row);
      if (row.type === 'expense' && row.status !== 'cancelled') {
        const category = row.category || 'other';
        if (!categories.has(category)) categories.set(category, { category, amountNet: 0, paidNet: 0, pendingNet: 0, count: 0 });
        const group = categories.get(category);
        add(group, 'amountNet', row.amountNet); add(group, row.status === 'paid' ? 'paidNet' : 'pendingNet', row.amountNet); group.count++;
      }
    }
  }
  collect(rows, dateFrom, dateTo, current, true);
  collect(previousRows, previousFrom, previousTo, previous, false);
  const totals = finish(current), previousTotals = finish(previous);
  return {
    totals, previousTotals, previousRange: { dateFrom: previousFrom, dateTo: previousTo },
    changes: Object.fromEntries(Object.keys(totals).map(key => [key, previousTotals[key] === 0 ? null : financeRound((totals[key] - previousTotals[key]) / Math.abs(previousTotals[key]) * 100)])),
    expenseCategories: [...categories.values()].sort((a, b) => b.amountNet - a.amountNet || a.category.localeCompare(b.category)),
    daily: [...daily].map(([date, total]) => ({ date, dateTo: date, ...finish(total) })),
  };
}

export function bucketFinanceReport(daily, unit = 'month') {
  const groups = new Map();
  for (let index = 0; index < daily.length; index++) {
    const point = daily[index];
    const key = unit === 'month' ? point.date.slice(0, 7) : unit === 'week' ? String(Math.floor(index / 7)) : point.date;
    if (!groups.has(key)) groups.set(key, { date: point.date, dateTo: point.date, ...empty() });
    const group = groups.get(key); group.dateTo = point.date;
    for (const metric of additive) add(group, metric, point[metric]);
  }
  return [...groups.values()].map(group => ({ date: group.date, dateTo: group.dateTo, ...finish(group) }));
}
