/** Currency and month formatting helpers (Korea-first). */

export function formatPrice(price: number, currency: string = "KRW"): string {
  if (currency === "KRW") {
    return `₩${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(price)}`;
  }
  const symbol =
    currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "JPY" ? "¥" : `${currency} `;
  return `${symbol}${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(price)}`;
}

/** Compact display for chart labels: 1234000 -> 123만 */
export function formatPriceCompact(price: number, currency: string = "KRW"): string {
  const formatted = new Intl.NumberFormat("ko-KR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(price);
  return currency === "KRW" ? `₩${formatted}` : `${formatted}`;
}

export function monthLabel(month: string): string {
  const mo = Number(month.split("-")[1]);
  return Number.isNaN(mo) ? month : `${mo}월`;
}

export function fullMonthLabel(month: string): string {
  const [y, mo] = month.split("-");
  return `${y}년 ${Number(mo)}월`;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Last `count` months ending at `end` (inclusive), oldest first. */
export function lastMonths(count: number, end: string = currentMonth()): string[] {
  const [y, m] = end.split("-").map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const total = y * 12 + (m - 1) - i;
    const yy = Math.floor(total / 12);
    const mm = (total % 12) + 1;
    out.push(`${yy}-${String(mm).padStart(2, "0")}`);
  }
  return out;
}

export function formatPct(value: number): string {
  const pct = Math.abs(value) * 100;
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1,
  }).format(pct)}%`;
}
