// Export only when the complete filtered read is consistent. Never download a partial file as complete.
export async function loadAllAdminRows(endpoint, params, { fetcher = fetch, key, maxOffset = 5000 } = {}) {
  const rows = []; const seen = new Set(); let expectedTotal;
  for (let offset = 0; offset <= maxOffset; offset += 200) {
    const query = new URLSearchParams(params); query.set('limit', '200'); query.set('offset', String(offset));
    const response = await fetcher(`${endpoint}?${query}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload?.data) || !Number.isInteger(payload?.meta?.total) || payload.meta.total < 0) throw new Error('EXPORT_READ_FAILED');
    const total = payload.meta.total;
    if (expectedTotal !== undefined && total !== expectedTotal) throw new Error('EXPORT_CHANGED');
    expectedTotal = total;
    for (const row of payload.data) {
      const id = key?.(row);
      if (key && (!id || seen.has(id))) throw new Error('EXPORT_CHANGED');
      if (id) seen.add(id); rows.push(row);
    }
    if (rows.length === total) return rows;
    if (rows.length > total || payload.data.length < 200) throw new Error('EXPORT_INCOMPLETE');
  }
  throw new Error('EXPORT_TOO_LARGE');
}

export async function collectAdminRows(readPage, { key, pageSize = 200, maxRows = 50000, parallelism = 4 } = {}) {
  const first = await readPage({ limit: pageSize, offset: 0 });
  const total = first.total;
  if (!Number.isInteger(total) || total < 0 || total > maxRows || !Array.isArray(first.rows)) throw new Error('DATASET_SCOPE_UNAVAILABLE');
  const rows = [...first.rows];
  for (let start = pageSize; start < total; start += pageSize * parallelism) {
    const offsets = Array.from({ length: parallelism }, (_, i) => start + i * pageSize).filter(offset => offset < total);
    const pages = await Promise.all(offsets.map(offset => readPage({ limit: pageSize, offset })));
    for (const page of pages) {
      if (page.total !== total || !Array.isArray(page.rows)) throw new Error('DATASET_CHANGED');
      rows.push(...page.rows);
    }
  }
  if (rows.length !== total || (key && new Set(rows.map(key)).size !== total)) throw new Error('DATASET_INCOMPLETE');
  return { rows, total };
}
