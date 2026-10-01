import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LogOut, Plus, Trash2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  addItem,
  deleteItem,
  getLedger,
  recordPrice,
  type LedgerEntry,
  type LedgerItem,
} from "@/lib/ledger.functions";
import {
  currentMonth,
  formatPct,
  formatPrice,
  formatPriceCompact,
  fullMonthLabel,
  lastMonths,
  monthLabel,
} from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "내 가격 장부 — Ledger" },
      { name: "description", content: "매달 기록한 가격과 전월 대비 변화를 확인하세요." },
      { property: "og:title", content: "내 가격 장부 — Ledger" },
      { property: "og:description", content: "매달 기록한 가격과 전월 대비 변화를 확인하세요." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

/** month -> price map per item. */
function indexEntries(entries: LedgerEntry[]) {
  const map = new Map<string, Map<string, number>>();
  for (const e of entries) {
    let m = map.get(e.item_id);
    if (!m) {
      m = new Map();
      map.set(e.item_id, m);
    }
    m.set(e.month, e.price);
  }
  return map;
}

function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const fetchLedger = useServerFn(getLedger);
  const addItemFn = useServerFn(addItem);
  const recordPriceFn = useServerFn(recordPrice);
  const deleteItemFn = useServerFn(deleteItem);

  const { data: ledger, isLoading } = useQuery({
    queryKey: ["ledger"],
    queryFn: () => fetchLedger(),
  });

  const [userLabel, setUserLabel] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setUserLabel(
        u.user_metadata?.["full_name"] || u.user_metadata?.["name"] || u.email || "",
      );
    });
  }, []);

  const items = ledger?.items ?? [];
  const entries = ledger?.entries ?? [];
  const byItemMonth = useMemo(() => indexEntries(entries), [entries]);

  const latestMonth = useMemo(
    () => entries.reduce((m, e) => (e.month > m ? e.month : m), ""),
    [entries],
  );
  const months = useMemo(() => lastMonths(4, latestMonth || currentMonth()), [latestMonth]);
  const prevMonth = months[months.length - 2] ?? currentMonth();

  const latestPrice = (item: LedgerItem) => byItemMonth.get(item.id)?.get(latestMonth);
  const prevPrice = (item: LedgerItem) => byItemMonth.get(item.id)?.get(prevMonth);
  const momPct = (item: LedgerItem): number | null => {
    const cur = latestPrice(item);
    const prev = prevPrice(item);
    if (cur === undefined || prev === undefined || prev === 0) return null;
    return (cur - prev) / prev;
  };

  const avgMoM = useMemo(() => {
    const pcts = items.map(momPct).filter((p): p is number => p !== null);
    if (pcts.length === 0) return null;
    return pcts.reduce((a, b) => a + b, 0) / pcts.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, entries, latestMonth, prevMonth]);

  const largestDrift = useMemo(() => {
    let best: { item: LedgerItem; pct: number } | null = null;
    for (const item of items) {
      const pct = momPct(item);
      if (pct === null) continue;
      if (!best || Math.abs(pct) > Math.abs(best.pct)) best = { item, pct };
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, entries, latestMonth, prevMonth]);

  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const selected = items.find((i) => i.id === selectedItemId) ?? items[0] ?? null;

  const [addOpen, setAddOpen] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");

  const invalidateLedger = () => queryClient.invalidateQueries({ queryKey: ["ledger"] });

  const addMutation = useMutation({
    mutationFn: (input: { name: string; category?: string }) => addItemFn({ data: input }),
    onSuccess: () => {
      setNameInput("");
      setCategoryInput("");
      setAddOpen(false);
      toast.success("항목을 추가했습니다.");
      invalidateLedger();
    },
    onError: (e: Error) => toast.error(e.message || "항목 추가에 실패했습니다."),
  });

  const recordMutation = useMutation({
    mutationFn: (input: { itemId: string; month: string; price: number }) =>
      recordPriceFn({ data: input }),
    onSuccess: () => {
      toast.success("가격을 기록했습니다.");
      invalidateLedger();
    },
    onError: (e: Error) => toast.error(e.message || "기록에 실패했습니다."),
  });

  const deleteMutation = useMutation({
    mutationFn: (itemId: string) => deleteItemFn({ data: { itemId } }),
    onSuccess: () => {
      toast.success("항목을 삭제했습니다.");
      setSelectedItemId("");
      invalidateLedger();
    },
    onError: (e: Error) => toast.error(e.message || "삭제에 실패했습니다."),
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  async function handleDelete(item: LedgerItem) {
    if (!window.confirm(`'${item.name}' 항목과 기록을 모두 삭제할까요?`)) return;
    deleteMutation.mutate(item.id);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-rule bg-panel backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-md bg-foreground font-display text-sm font-extrabold text-background">
              L
            </span>
            <span className="font-display text-[15px] font-bold tracking-tight">Ledger</span>
          </div>
          <div className="flex items-center gap-3">
            {userLabel ? (
              <span className="hidden text-[13px] font-medium text-muted-foreground sm:inline">
                {userLabel}
              </span>
            ) : null}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-lg border border-rule bg-panel-strong px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-background"
            >
              <LogOut className="size-3.5" />
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        <section className="flex flex-col gap-8 pt-10 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[30ch] animate-rise">
            <p className="num text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Personal price ledger
            </p>
            <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-balance">
              모든 가격, 질서 있게.
            </h1>
            <p className="mt-3 text-pretty text-[15px] text-muted-foreground">
              매달 가격을 기록하고, 변화는 소음 없이 확인하세요.
            </p>
          </div>
          <div className="flex items-center gap-2.5 animate-rise [animation-delay:80ms]">
            <button
              onClick={() => {
                if (items.length === 0) {
                  setAddOpen(true);
                  return;
                }
                document.getElementById("record-card")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground ring-1 ring-primary/40 transition hover:bg-primary/90 active:translate-y-px"
            >
              이번 달 기록
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-lg border border-rule bg-panel-strong px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-background active:translate-y-px"
            >
              항목 추가
            </button>
          </div>
        </section>

        <section className="grid gap-5 sm:grid-cols-3 animate-rise [animation-delay:140ms]">
          <div className="frosted rounded-xl p-5">
            <p className="num text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              추적 항목
            </p>
            <p className="num mt-2 font-display text-3xl font-extrabold tracking-tight">
              {items.length}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {items.length > 0
                ? `기준 월: ${fullMonthLabel(latestMonth || currentMonth())}`
                : "첫 항목을 추가해 보세요"}
            </p>
          </div>
          <div className="frosted rounded-xl p-5">
            <p className="num text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              평균 전월 대비
            </p>
            {avgMoM === null ? (
              <p className="num mt-2 font-display text-3xl font-extrabold tracking-tight text-muted-foreground">
                —
              </p>
            ) : (
              <p
                className={`num mt-2 font-display text-3xl font-extrabold tracking-tight ${
                  avgMoM > 0 ? "text-fall" : avgMoM < 0 ? "text-rise" : "text-foreground"
                }`}
              >
                {formatPct(avgMoM)}
              </p>
            )}
            <p className="mt-1 text-[13px] text-muted-foreground">기록이 2번 이상 있는 항목 기준</p>
          </div>
          <div className="frosted rounded-xl p-5">
            <p className="num text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              가장 큰 변동
            </p>
            {largestDrift ? (
              <p
                className={`num mt-2 font-display text-3xl font-extrabold tracking-tight ${
                  largestDrift.pct > 0 ? "text-fall" : "text-rise"
                }`}
              >
                {formatPct(largestDrift.pct)}
              </p>
            ) : (
              <p className="num mt-2 font-display text-3xl font-extrabold tracking-tight text-muted-foreground">
                —
              </p>
            )}
            <p className="mt-1 text-[13px] text-muted-foreground">
              {largestDrift ? largestDrift.item.name : "아직 비교할 기록이 없어요"}
            </p>
          </div>
        </section>

        <section className="mt-6 animate-rise [animation-delay:200ms]">
          <div className="flex items-center justify-between px-1 pb-2">
            <h2 className="font-display text-[15px] font-bold tracking-tight">추적 항목</h2>
            <span className="num text-[11px] text-muted-foreground">
              기준 {fullMonthLabel(latestMonth || currentMonth())}
            </span>
          </div>

          {isLoading ? (
            <div className="frosted rounded-xl px-5 py-10 text-center text-sm text-muted-foreground">
              불러오는 중…
            </div>
          ) : items.length === 0 ? (
            <div className="frosted rounded-xl px-6 py-12 text-center">
              <p className="font-display text-lg font-bold tracking-tight">
                아직 추적 중인 항목이 없어요
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                자주 사는 상품을 추가하고 매달 가격을 기록해 보세요.
              </p>
              <button
                onClick={() => setAddOpen(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground ring-1 ring-primary/40 transition hover:bg-primary/90"
              >
                <Plus className="size-4" />
                첫 항목 추가하기
              </button>
            </div>
          ) : (
            <div className="frosted overflow-hidden rounded-xl ring-1 ring-foreground/5">
              <div className="grid min-w-[560px] grid-cols-[minmax(0,2fr)_repeat(4,84px)_96px_44px] items-center gap-1 border-b border-rule px-5 py-2.5 num text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:min-w-0">
                <span>항목</span>
                {months.map((m) => (
                  <span key={m} className="text-right">
                    {monthLabel(m)}
                  </span>
                ))}
                <span className="text-right">전월 대비</span>
                <span aria-hidden="true" />
              </div>

              {items.map((item) => {
                const pct = momPct(item);
                return (
                  <div
                    key={item.id}
                    className="grid min-w-[560px] grid-cols-[minmax(0,2fr)_repeat(4,84px)_96px_44px] items-center gap-1 border-b border-rule px-5 py-3 transition-colors last:border-b-0 hover:bg-glass sm:min-w-0"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(item.id)}
                      className="min-w-0 pr-3 text-left"
                      title="아래 차트에서 이 항목 보기"
                    >
                      <p className="truncate text-[14px] font-medium">{item.name}</p>
                      <p className="num truncate text-[11px] text-muted-foreground">
                        {item.category || "기록 중"}
                      </p>
                    </button>
                    {months.map((m) => {
                      const price = byItemMonth.get(item.id)?.get(m);
                      const isLatest = m === latestMonth;
                      return (
                        <span
                          key={m}
                          className={`num text-right text-[13px] ${
                            price === undefined
                              ? "text-muted-foreground/50"
                              : isLatest
                                ? "font-medium text-foreground"
                                : "text-muted-foreground"
                          }`}
                        >
                          {price === undefined ? "—" : formatPrice(price, item.currency)}
                        </span>
                      );
                    })}
                    <span className="text-right">
                      <DeltaBadge pct={pct} />
                    </span>
                    <span className="text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`${item.name} 삭제`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {items.length > 0 ? (
          <section className="mt-6 grid gap-5 lg:grid-cols-2 animate-rise [animation-delay:260ms]">
            <RecordCard
              items={items}
              selected={selected}
              pending={recordMutation.isPending}
              onSave={(itemId, month, price) => recordMutation.mutate({ itemId, month, price })}
              currentMonthValue={currentMonth()}
              byItemMonth={byItemMonth}
            />

            <TrendCard item={selected} byItemMonth={byItemMonth} currency={selected?.currency ?? "KRW"} />
          </section>
        ) : null}
      </main>

      <footer className="mt-10 border-t border-rule bg-panel backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-6 py-5 num text-[11px] text-muted-foreground">
          <span>Ledger · 기록은 나에게만 보입니다.</span>
          <span>가격은 직접 입력한 값입니다.</span>
        </div>
      </footer>

      {addOpen ? (
        <AddItemDialog
          pending={addMutation.isPending}
          name={nameInput}
          category={categoryInput}
          onNameChange={setNameInput}
          onCategoryChange={setCategoryInput}
          onClose={() => setAddOpen(false)}
          onSubmit={() => {
            if (!nameInput.trim()) {
              toast.error("이름을 입력하세요.");
              return;
            }
            const category = categoryInput.trim();
            addMutation.mutate(
              category ? { name: nameInput.trim(), category } : { name: nameInput.trim() },
            );
          }}
        />
      ) : null}
    </div>
  );
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="num text-[12px] text-muted-foreground">—</span>
    );
  }
  if (pct === 0) {
    return <span className="num text-[12px] font-medium text-muted-foreground">0.0%</span>;
  }
  const rising = pct > 0;
  return (
    <span className={`num text-[12px] font-medium ${rising ? "text-fall" : "text-rise"}`}>
      {rising ? "▲" : "▼"} {formatPct(pct)}
    </span>
  );
}

function RecordCard({
  items,
  selected,
  pending,
  onSave,
  currentMonthValue,
  byItemMonth,
}: {
  items: LedgerItem[];
  selected: LedgerItem | null;
  pending: boolean;
  onSave: (itemId: string, month: string, price: number) => void;
  currentMonthValue: string;
  byItemMonth: Map<string, Map<string, number>>;
}) {
  const [itemId, setItemId] = useState("");
  const [month, setMonth] = useState(currentMonthValue);
  const [priceText, setPriceText] = useState("");

  const effectiveId = itemId || selected?.id || "";
  const effectiveItem = items.find((i) => i.id === effectiveId) ?? null;
  const history = effectiveItem ? [...(byItemMonth.get(effectiveItem.id) ?? [])] : [];
  const sortedMonths = history
    .map((m) => m[0])
    .sort()
    .reverse();
  const lastPrice = sortedMonths.length > 0 ? byItemMonth.get(effectiveItem!.id)!.get(sortedMonths[0] ?? "") : undefined;
  const secondPrice =
    sortedMonths.length > 1 ? byItemMonth.get(effectiveItem!.id)!.get(sortedMonths[1] ?? "") : undefined;
  const delta =
    lastPrice !== undefined && secondPrice !== undefined && secondPrice !== 0
      ? (lastPrice - secondPrice) / secondPrice
      : null;

  return (
    <div className="frosted rounded-xl p-6" id="record-card">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="num text-[11px] uppercase tracking-[0.14em] text-muted-foreground">가격 기록</p>
          <p className="mt-1 font-display text-lg font-bold tracking-tight">
            {effectiveItem ? effectiveItem.name : "항목을 선택하세요"}
          </p>
        </div>
        {month ? <span className="num text-[11px] text-muted-foreground">{fullMonthLabel(month)}</span> : null}
      </div>

      <div className="mt-5 flex items-end gap-6">
        <div>
          <p className="num text-[11px] text-muted-foreground">마지막 기록</p>
          <p className="num text-2xl text-muted-foreground">
            {lastPrice !== undefined ? formatPrice(lastPrice, effectiveItem?.currency ?? "KRW") : "—"}
          </p>
        </div>
        <div className="h-10 w-px bg-rule" aria-hidden="true" />
        <div>
          <p className="num text-[11px] text-muted-foreground">전월 대비</p>
          {delta === null ? (
            <p className="num text-2xl text-muted-foreground">—</p>
          ) : (
            <p
              className={`num text-2xl font-medium ${
                delta > 0 ? "text-fall" : delta < 0 ? "text-rise" : "text-foreground"
              }`}
            >
              {formatPct(delta)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-[1fr_140px]">
        <select
          value={effectiveId}
          onChange={(e) => setItemId(e.target.value)}
          className="w-full rounded-lg border border-rule bg-panel-strong px-3 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-full rounded-lg border border-rule bg-panel-strong px-3 py-2.5 num text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div className="mt-2.5 flex gap-2.5">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-rule bg-panel-strong px-3 py-2.5">
          <span className="num text-[13px] text-muted-foreground">₩</span>
          <input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="가격을 입력하세요"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            className="num w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/60"
          />
        </label>
        <button
          type="button"
          disabled={pending || !effectiveId || !month || priceText === ""}
          onClick={() => {
            const price = Number(priceText);
            if (!Number.isFinite(price) || price < 0) {
              toast.error("올바른 가격을 입력하세요.");
              return;
            }
            onSave(effectiveId, month, price);
            setPriceText("");
          }}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground ring-1 ring-primary/40 transition hover:bg-primary/90 active:translate-y-px disabled:opacity-50"
        >
          {pending ? "저장 중…" : "기록 저장"}
        </button>
      </div>
    </div>
  );
}

function TrendCard({
  item,
  byItemMonth,
  currency,
}: {
  item: LedgerItem | null;
  byItemMonth: Map<string, Map<string, number>>;
  currency: string;
}) {
  const history = useMemo(() => {
    if (!item) return [] as { month: string; price: number }[];
    const map = byItemMonth.get(item.id);
    if (!map) return [] as { month: string; price: number }[];
    return [...map.entries()]
      .map(([month, price]) => ({ month, price }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-8);
  }, [item, byItemMonth]);

  const max = Math.max(...history.map((h) => h.price), 0);
  const first = history[0];
  const last = history[history.length - 1];
  const overall =
    first && last && first.price !== 0 ? (last.price - first.price) / first.price : null;

  return (
    <div className="frosted rounded-xl p-6">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg font-bold tracking-tight">
          {item ? item.name : "추이"}
        </p>
        {overall !== null ? (
          <span
            className={`num text-[11px] ${overall > 0 ? "text-fall" : "text-rise"}`}
          >
            {formatPct(overall)} · {history.length}개월
          </span>
        ) : null}
      </div>

      {history.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          이 항목에는 아직 기록이 없어요. 가격 기록 카드에서 첫 가격을 저장해 보세요.
        </p>
      ) : (
        <>
          <div className="mt-6 flex h-40 items-end gap-3">
            {history.map((h, i) => (
              <div key={h.month} className="flex h-full flex-1 flex-col justify-end">
                <div
                  className="bar-anim w-full rounded-t bg-primary"
                  style={{
                    height: max > 0 ? `${Math.max((h.price / max) * 100, 2)}%` : "2%",
                    animationDelay: `${i * 60}ms`,
                    opacity: i === history.length - 1 ? 1 : 0.55 + (i / history.length) * 0.35,
                  }}
                />
                <span className="num mt-2 text-center text-[10px] text-muted-foreground">
                  {formatPriceCompact(h.price, currency)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between border-t border-rule pt-2 num text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {history.map((h) => (
              <span key={h.month}>{monthLabel(h.month)}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AddItemDialog({
  pending,
  name,
  category,
  onNameChange,
  onCategoryChange,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  name: string;
  category: string;
  onNameChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-6">
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="frosted relative w-full max-w-md rounded-2xl bg-panel-strong p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="num text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              새 항목
            </p>
            <h2 className="mt-1 font-display text-lg font-bold tracking-tight">
              어떤 가격을 추적할까요?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-glass"
            aria-label="닫기"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-[12px] font-medium text-muted-foreground">이름</span>
            <input
              autoFocus
              value={name}
              maxLength={120}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="예: 원두 1kg"
              className="mt-1 w-full rounded-lg border border-rule bg-panel-strong px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted-foreground">분류 (선택)</span>
            <input
              value={category}
              maxLength={60}
              onChange={(e) => onCategoryChange(e.target.value)}
              placeholder="예: 식료품 · 홈 · 구독"
              className="mt-1 w-full rounded-lg border border-rule bg-panel-strong px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="rounded-lg border border-rule bg-panel-strong px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-background"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={pending}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground ring-1 ring-primary/40 transition hover:bg-primary/90 active:translate-y-px disabled:opacity-50"
          >
            {pending ? "추가 중…" : "항목 추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
