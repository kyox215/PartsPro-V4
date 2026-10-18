// Shared deterministic finance rules. Money is rounded at the cent boundary.
export const financeRound = value => Math.round((value + Number.EPSILON) * 100) / 100;
export function parseFinanceMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 && value <= 1e9 && /^\d+(?:\.\d{1,2})?$/.test(String(value)) ? value : null;
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  let normalized = raw;
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(raw)) normalized = raw.replaceAll('.', '').replace(',', '.');
  else if (/^\d{1,3}(,\d{3})+\.\d{1,2}$/.test(raw)) normalized = raw.replaceAll(',', '');
  else if (/^\d+([.,]\d{1,2})?$/.test(raw)) normalized = raw.replace(',', '.');
  else return null;
  return parseFinanceMoney(Number(normalized));
}
export function validFinanceDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function financeDay(value = new Date().toISOString()) {
  if (validFinanceDate(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function shiftFinanceDay(value, days) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function financeRomeLocalToIso(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !validFinanceDate(value.slice(0, 10))) return null;
  if (!Number.isFinite(Date.parse(value + ':00Z'))) return null;
  const candidates = [1, 2].map(offset => new Date(Date.parse(value + ':00Z') - offset * 3600000)).filter(date => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(date).map(p => [p.type,p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` === value;
  });
  return candidates.length === 1 ? candidates[0].toISOString() : null;
}
export function financeLocalInput(value = new Date().toISOString()) {
  const date = new Date(value);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(date).map(p => [p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function buildFinanceAnalysis(rows, previousRows, dateFrom, dateTo) {
  const point = date => ({date, salesNet:0, cogsNet:0, expenseNet:0, grossProfit:0, operatingProfit:0});
  const days = new Map();
  for(let day=dateFrom; day<=dateTo; day=shiftFinanceDay(day,1)) days.set(day,point(day));
  const categories = new Map();
  function totals(source, withDays=false) {
    const total = point('');
    for(const row of source) {
      const key = row.type === 'sale' ? 'salesNet' : row.type === 'cogs' ? 'cogsNet' : row.type === 'expense' && row.status !== 'cancelled' ? 'expenseNet' : null;
      if (!key) continue;
      total[key] = financeRound(total[key] + row.amountNet);
      if(withDays) {
        const day=days.get(financeDay(row.date));
        if(day) day[key]=financeRound(day[key]+row.amountNet);
        if(key==='expenseNet') categories.set(row.category || 'other',financeRound((categories.get(row.category || 'other') || 0)+row.amountNet));
      }
    }
    total.grossProfit=financeRound(total.salesNet-total.cogsNet);
    total.operatingProfit=financeRound(total.grossProfit-total.expenseNet);
    return total;
  }
  const current=totals(rows,true), previous=totals(previousRows);
  const changes=Object.fromEntries(['salesNet','cogsNet','expenseNet','grossProfit','operatingProfit'].map(key => [key,previous[key]===0?null:financeRound((current[key]-previous[key])/Math.abs(previous[key])*100)]));
  const trend=Array.from(days.values()).map(day=>({...day,grossProfit:financeRound(day.salesNet-day.cogsNet),operatingProfit:financeRound(day.salesNet-day.cogsNet-day.expenseNet)}));
  return {trend,previous,changes,expenses:Array.from(categories,([category,amountNet])=>({category,amountNet})).sort((a,b)=>b.amountNet-a.amountNet)};
}
