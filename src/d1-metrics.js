// Request-scoped accounting, including submission/admin reads and batch writes.
// Never log SQL, parameters, query strings, payloads or credentials.
export function instrumentDatabase(database, stats) {
  const originals = new WeakMap();
  const record = result => {
    stats.queries++;
    if (Number.isFinite(result?.meta?.rows_read)) stats.rowsRead += result.meta.rows_read;
    else stats.unknown++;
    return result;
  };
  const wrap = statement => {
    const wrapped = {
      bind(...values) { return wrap(statement.bind(...values)); },
      async all() { return record(await statement.all()); },
      async run() { return record(await statement.run()); },
      async first(column) {
        const result = record(await statement.all());
        const row = result.results?.[0] || null;
        return column === undefined ? row : row?.[column] ?? null;
      },
    };
    originals.set(wrapped, statement);
    return wrapped;
  };
  return {
    prepare(sql) { return wrap(database.prepare(sql)); },
    async batch(statements) {
      const results = await database.batch(statements.map(statement => originals.get(statement) || statement));
      results.forEach(record);
      return results;
    },
  };
}
