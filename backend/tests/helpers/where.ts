// A tiny in-memory evaluator for the subset of Prisma `where`
// syntax the status filters use (AND/OR, null, { not: null },
// gt/gte/lt/lte on dates). Lets unit tests prove the database
// filter and the JS status function agree, without a database.

type Row = Record<string, unknown>;

function compare(value: unknown, op: string, operand: unknown) {
  if (op === "not") {
    return operand === null ? value !== null : value !== operand;
  }

  if (!(value instanceof Date) || !(operand instanceof Date)) {
    return false;
  }

  const a = value.getTime();
  const b = operand.getTime();

  switch (op) {
    case "gt":
      return a > b;
    case "gte":
      return a >= b;
    case "lt":
      return a < b;
    case "lte":
      return a <= b;
    default:
      throw new Error(`Unsupported operator ${op}`);
  }
}

export function matchesWhere(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") {
      return (condition as Row[]).every((part) => matchesWhere(row, part));
    }

    if (key === "OR") {
      return (condition as Row[]).some((part) => matchesWhere(row, part));
    }

    const value = row[key] ?? null;

    if (condition === null) {
      return value === null;
    }

    if (typeof condition === "object" && !(condition instanceof Date)) {
      return Object.entries(condition as Row).every(([op, operand]) =>
        compare(value, op, operand)
      );
    }

    return value === condition;
  });
}
