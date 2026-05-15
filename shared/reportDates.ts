export function reportDateSortKey(value: unknown): string {
  const date = toDate(value);
  if (date) return date.toISOString().slice(0, 10);
  if (typeof value === "string") return value;
  return "";
}

export function formatReportDate(value: unknown): string {
  const date = toDate(value);
  if (date) return date.toISOString().slice(0, 10);
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const dateLike = value as { fmt?: unknown; raw?: unknown };
    if (typeof dateLike.fmt === "string" && dateLike.fmt.trim()) {
      return dateLike.fmt.slice(0, 10);
    }
    if (dateLike.raw !== undefined) {
      return formatReportDate(dateLike.raw);
    }
  }
  return "";
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (value && typeof value === "object") {
    const dateLike = value as { fmt?: unknown; raw?: unknown };
    if (typeof dateLike.fmt === "string") return toDate(dateLike.fmt);
    if (dateLike.raw !== undefined) return toDate(dateLike.raw);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const timestamp = value < 1_000_000_000_000 ? value * 1000 : value;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== "string" || value.trim() === "") return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
