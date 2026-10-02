import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Search,
  Star,
  TrendingDown,
  WalletCards,
  X,
} from "lucide-react";
import marketJson from "@/data/real-estate-market.json";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UnitType = "84" | "낀" | "59";
type Basis = "sale" | "jeonse";
type Metric = "매매" | "전세" | "투자금";
type MonthValue = { 매매?: number; 전세?: number; 개수?: number };
type Complex = {
  no: number;
  si: string;
  gu: string;
  name: string;
  months: Record<string, Partial<Record<UnitType, MonthValue>>>;
};
type MatrixEntry = {
  name: string;
  district?: string;
  price: number;
  salePrice?: number;
  ratePct?: number | null;
  jeonseSource?: "real" | "estimated";
};
type MatrixRow = { band: string; cells: Record<string, MatrixEntry[]> };
type MatrixSet = { districts: string[]; rows: MatrixRow[] };
type QuintileEntry = MatrixEntry & { jeonse?: number; investment?: number };
type QuintileRow = {
  band: string;
  byRate: QuintileEntry[];
  byInvest: QuintileEntry[];
};
type RawType = { peak?: number; sale?: number; jeonse?: number };
type RawMeta = { builtYear?: string; households?: number; types?: Partial<Record<UnitType, RawType>> };
type MarketData = {
  meta: { sourceFile: string; generatedAt: string; months: string[]; latestMonth: string };
  complexes: Complex[];
  bands: Partial<Record<UnitType, MatrixSet>>;
  jeonseBands: Partial<Record<UnitType, MatrixSet>>;
  quintile: Partial<Record<UnitType, QuintileRow[]>>;
  rawMeta: Record<string, RawMeta>;
  ratios: {
    byMatrixDistrict?: Partial<Record<UnitType, Record<string, { ratio: number }>>>;
    typeOverall?: Partial<Record<UnitType, { ratio: number }>>;
    overall?: number;
  };
};

type Candidate = {
  key: string;
  name: string;
  type: UnitType;
  district: string;
  builtYear: string;
  households: number | null;
  peak: number | null;
  sale: number;
  jeonse: number;
  investment: number;
  rate: number | null;
  estimated: boolean;
};

const DATA = marketJson as unknown as MarketData;
const TYPES: UnitType[] = ["84", "낀", "59"];
const LINE_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function eok(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value)}억`;
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function monthLabel(month: string) {
  const part = month.split(".")[1];
  return part ? `${Number(part)}월` : month;
}

function districtOf(complex: Complex) {
  if (complex.si === "서울시" || complex.si === "서울특별시") return complex.gu;
  if (complex.gu.includes("구")) return complex.gu;
  return complex.si || complex.gu;
}

function latestValue(complex: Complex, type: UnitType) {
  return complex.months[DATA.meta.latestMonth]?.[type];
}

function estimateJeonse(complex: Complex, type: UnitType, sale: number) {
  const current = latestValue(complex, type);
  if (typeof current?.전세 === "number" && (current.개수 ?? 0) > 0) {
    return { price: current.전세, estimated: false };
  }
  if (typeof current?.전세 === "number") return { price: current.전세, estimated: true };
  const district = districtOf(complex);
  const ratio =
    DATA.ratios.byMatrixDistrict?.[type]?.[district]?.ratio ??
    DATA.ratios.typeOverall?.[type]?.ratio ??
    DATA.ratios.overall ??
    0.58;
  return { price: Math.round(sale * ratio * 100) / 100, estimated: true };
}

function rateClass(rate: number | null | undefined) {
  if (rate === null || rate === undefined) return "bg-muted text-muted-foreground";
  if (rate <= -8) return "bg-rise/20 text-rise";
  if (rate < 0) return "bg-rise/10 text-rise";
  if (rate >= 8) return "bg-fall/20 text-fall";
  if (rate > 0) return "bg-fall/10 text-fall";
  return "bg-muted text-muted-foreground";
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="inline-grid auto-cols-fr grid-flow-col rounded-md border border-rule bg-muted p-0.5" aria-label={label}>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChange(option.value)}
          className={cn(
            "h-7 rounded px-3 text-[12px] shadow-none",
            value === option.value && "bg-panel-strong text-foreground shadow-sm hover:bg-panel-strong",
          )}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function Section({
  eyebrow,
  title,
  description,
  controls,
  defaultOpen = false,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  controls?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-rule py-7 first:border-t-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <p className="num text-[10px] font-semibold uppercase text-primary">{eyebrow}</p>
          <h2 className="mt-1 font-display text-xl font-bold">{title}</h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={`${title} ${open ? "접기" : "펼치기"}`}
          title={open ? "접기" : "펼치기"}
          className="shrink-0"
        >
          {open ? <ChevronUp /> : <ChevronDown />}
        </Button>
      </div>
      {open ? (
        <div className="mt-4 animate-rise">
          {controls ? <div className="mb-3 flex flex-wrap items-center gap-2">{controls}</div> : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

function QuintileTable() {
  const [type, setType] = useState<UnitType>("84");
  const [basis, setBasis] = useState<"rate" | "invest">("rate");
  const rows = DATA.quintile[type] ?? [];
  return (
    <Section
      eyebrow="Top 5 by price tier"
      title="5분위 시세표"
      description="가격대마다 전고점 대비 하락폭 또는 필요한 투자금이 낮은 단지 다섯 곳을 비교합니다."
      defaultOpen
      controls={
        <>
          <Segmented value={type} options={TYPES.map((v) => ({ value: v, label: `${v}㎡` }))} onChange={setType} label="평형 선택" />
          <Segmented
            value={basis}
            options={[{ value: "rate", label: "전고점 대비" }, { value: "invest", label: "투자금 기준" }]}
            onChange={setBasis}
            label="순위 기준"
          />
          <span className="text-[11px] text-muted-foreground">낮은 값부터 1위</span>
        </>
      }
    >
      <div className="frosted overflow-x-auto rounded-lg">
        <table className="w-full min-w-[780px] border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-[11px] text-muted-foreground">
              <th className="sticky left-0 z-10 w-24 border-b border-rule bg-panel-strong px-3 py-2.5">가격대</th>
              {[1, 2, 3, 4, 5].map((rank) => <th key={rank} className="border-b border-rule px-2 py-2.5">{rank}위</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const ranked = basis === "rate" ? row.byRate : row.byInvest;
              return (
                <tr key={row.band} className="align-top hover:bg-glass">
                  <th className="sticky left-0 z-10 border-b border-rule bg-panel-strong px-3 py-3 num text-[12px]">{row.band}</th>
                  {[0, 1, 2, 3, 4].map((index) => {
                    const entry = ranked[index];
                    return (
                      <td key={index} className="min-w-36 border-b border-rule px-2 py-2">
                        {entry ? (
                          <div className="rounded-md border border-rule bg-background/70 p-2">
                            <p className="max-w-36 truncate text-[12px] font-semibold" title={entry.name}>{entry.name}</p>
                            <p className={cn("num mt-1 text-[10px]", basis === "rate" && entry.ratePct !== undefined && entry.ratePct !== null ? (entry.ratePct > 0 ? "text-fall" : "text-rise") : "text-muted-foreground")}>{entry.district} · {basis === "rate" ? pct(entry.ratePct) : eok(entry.investment)}</p>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Matrix({ watched, toggleWatch }: { watched: Set<string>; toggleWatch: (name: string, type: UnitType) => void }) {
  const [type, setType] = useState<UnitType>("84");
  const [basis, setBasis] = useState<Basis>("sale");
  const [query, setQuery] = useState("");
  const set = (basis === "sale" ? DATA.bands : DATA.jeonseBands)[type];
  const districts = (set?.districts ?? []).filter((district) => district.includes(query.trim()));
  return (
    <Section
      eyebrow="Price × region"
      title="가격대 × 지역 매트릭스"
      description="가격대와 지역을 교차해 단지를 비교합니다. 별을 누르면 저평가 후보에 바로 반영됩니다."
      controls={
        <>
          <Segmented value={basis} options={[{ value: "sale", label: "매매가" }, { value: "jeonse", label: "전세가" }]} onChange={setBasis} label="가격 기준" />
          <Segmented value={type} options={TYPES.map((v) => ({ value: v, label: `${v}㎡` }))} onChange={setType} label="평형 선택" />
          <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-background px-2.5 sm:max-w-64">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="지역 검색" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground" />
          </label>
        </>
      }
    >
      <div className="frosted overflow-x-auto rounded-lg">
        <table className="border-separate border-spacing-0 text-left">
          <thead>
            <tr className="text-[11px] text-muted-foreground">
              <th className="sticky left-0 top-0 z-20 min-w-20 border-b border-r border-rule bg-panel-strong px-3 py-2.5">가격대</th>
              {districts.map((district) => <th key={district} className="sticky top-0 z-10 min-w-44 border-b border-rule bg-panel-strong px-2 py-2.5">{district}</th>)}
            </tr>
          </thead>
          <tbody>
            {(set?.rows ?? []).map((row) => (
              <tr key={row.band} className="align-top">
                <th className="sticky left-0 z-10 border-b border-r border-rule bg-panel-strong px-3 py-3 num text-[12px]">{row.band}</th>
                {districts.map((district) => (
                  <td key={district} className="min-w-44 border-b border-rule p-1.5">
                    <div className="space-y-1">
                      {(row.cells[district] ?? []).map((entry) => {
                        const key = `${entry.name}::${type}`;
                        return (
                          <div key={key} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md px-2 py-1.5", basis === "sale" ? rateClass(entry.ratePct) : "bg-muted text-foreground")}>
                            <button type="button" onClick={() => toggleWatch(entry.name, type)} className="min-w-0 text-left" title={`${entry.name} 관심 후보 전환`}>
                              <span className="block truncate text-[11px] font-semibold">{entry.name}</span>
                              <span className="num block text-[10px] opacity-75">{basis === "sale" ? `${pct(entry.ratePct)} · ${eok(entry.price)}` : `${eok(entry.price)} · ${entry.jeonseSource === "estimated" ? "추정" : "실거래"}`}</span>
                            </button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => toggleWatch(entry.name, type)} aria-label={`${entry.name} ${watched.has(key) ? "관심 해제" : "관심 추가"}`} className="size-7">
                              <Star className={cn("size-3.5", watched.has(key) && "fill-primary text-primary")} />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span>초록: 전고점 대비 하락</span><span>빨강: 전고점 대비 상승</span><span>전세 매물이 없으면 지역 평균 전세가율로 추정</span>
      </div>
    </Section>
  );
}

function TrendChart() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<UnitType>("84");
  const [metric, setMetric] = useState<Metric>("매매");
  const [selected, setSelected] = useState<string[]>(() => DATA.complexes.slice(0, 3).map((complex) => complex.name));
  const matches = useMemo(() => DATA.complexes.filter((complex) => complex.name.includes(query.trim()) || complex.gu.includes(query.trim())).slice(0, 30), [query]);
  const selectedComplexes = selected.map((name) => DATA.complexes.find((complex) => complex.name === name)).filter((complex): complex is Complex => Boolean(complex));
  const chartData = DATA.meta.months.map((month) => {
    const row: Record<string, string | number | null> = { month: monthLabel(month) };
    selectedComplexes.forEach((complex) => {
      const value = complex.months[month]?.[type];
      const sale = value?.매매;
      const jeonse = value?.전세;
      row[complex.name] = metric === "매매" ? sale ?? null : metric === "전세" ? jeonse ?? null : sale !== undefined && jeonse !== undefined ? Math.round((sale - jeonse) * 100) / 100 : null;
    });
    return row;
  });
  function toggle(name: string) {
    setSelected((current) => current.includes(name) ? current.filter((value) => value !== name) : current.length < 4 ? [...current, name] : current);
  }
  return (
    <Section
      eyebrow="Monthly tracking"
      title="월별 시세 추이"
      description={`${monthLabel(DATA.meta.months[0] ?? "")}부터 ${monthLabel(DATA.meta.latestMonth)}까지 단지별 매매가·전세가·투자금을 비교합니다.`}
      controls={
        <>
          <Segmented value={type} options={TYPES.map((v) => ({ value: v, label: `${v}㎡` }))} onChange={setType} label="평형 선택" />
          <Segmented value={metric} options={[{ value: "매매", label: "매매" }, { value: "전세", label: "전세" }, { value: "투자금", label: "투자금" }]} onChange={setMetric} label="지표 선택" />
        </>
      }
    >
      <div className="frosted grid overflow-hidden rounded-lg lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="border-b border-rule p-3 lg:border-r lg:border-b-0">
          <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2.5">
            <Search className="size-3.5 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="단지명 또는 지역 검색" className="min-w-0 flex-1 bg-transparent text-[12px] outline-none" />
          </label>
          <div className="mt-2 max-h-44 overflow-y-auto lg:max-h-72">
            {matches.map((complex) => (
              <Button key={complex.no} type="button" variant="ghost" onClick={() => toggle(complex.name)} className={cn("h-auto w-full justify-start px-2 py-2 text-left", selected.includes(complex.name) && "bg-primary/10 text-primary")}>
                <span className="min-w-0"><span className="block truncate text-[12px]">{complex.name}</span><span className="block truncate text-[10px] text-muted-foreground">{complex.gu}</span></span>
              </Button>
            ))}
          </div>
        </div>
        <div className="min-w-0 p-3 sm:p-5">
          <div className="mb-3 flex min-h-7 flex-wrap gap-1.5">
            {selectedComplexes.map((complex, index) => (
              <Button key={complex.name} size="sm" variant="outline" onClick={() => toggle(complex.name)} className="h-7 max-w-48 gap-1 px-2 text-[10px]">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: LINE_COLORS[index] }} />
                <span className="truncate">{complex.name}</span><X className="size-3" />
              </Button>
            ))}
          </div>
          <div className="h-72 w-full" aria-label="월별 시세 선형 차트">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--rule)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: "var(--rule)" }} tickLine={false} />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${value}억`} />
                <Tooltip formatter={(value) => [eok(typeof value === "number" ? value : null), metric]} contentStyle={{ background: "var(--popover)", border: "1px solid var(--rule)", borderRadius: 6, fontSize: 11 }} />
                <Area type="monotone" dataKey={selectedComplexes[0]?.name ?? ""} fill="var(--glass)" stroke="none" connectNulls />
                {selectedComplexes.map((complex, index) => <Line key={complex.name} type="monotone" dataKey={complex.name} stroke={LINE_COLORS[index]} strokeWidth={2} dot={{ r: 3, fill: "var(--background)" }} activeDot={{ r: 5 }} connectNulls />)}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Section>
  );
}

function candidateFor(name: string, type: UnitType): Candidate | null {
  const complex = DATA.complexes.find((entry) => entry.name === name);
  const value = complex ? latestValue(complex, type) : undefined;
  if (!complex || typeof value?.매매 !== "number") return null;
  const raw = DATA.rawMeta[name];
  const rawType = raw?.types?.[type];
  const jeonse = estimateJeonse(complex, type, value.매매);
  const peak = rawType?.peak ?? null;
  const rate = peak && peak > 0 ? ((value.매매 - peak) / peak) * 100 : null;
  return {
    key: `${name}::${type}`,
    name,
    type,
    district: districtOf(complex),
    builtYear: raw?.builtYear ?? "—",
    households: raw?.households ?? null,
    peak,
    sale: value.매매,
    jeonse: jeonse.price,
    investment: Math.round((value.매매 - jeonse.price) * 100) / 100,
    rate,
    estimated: jeonse.estimated,
  };
}

function Watchlist({ candidates, remove }: { candidates: Candidate[]; remove: (candidate: Candidate) => void }) {
  const [sortKey, setSortKey] = useState<"investment" | "rate">("investment");
  const sorted = [...candidates].sort((a, b) => (sortKey === "investment" ? a.investment - b.investment : (a.rate ?? 999) - (b.rate ?? 999)));
  return (
    <Section
      eyebrow="Watchlist"
      title="저평가 후보 리스트"
      description="관심 표시한 단지에 연식·세대수·전고점을 붙이고, 매매가에서 전세가를 뺀 투자금을 계산합니다."
      controls={<Segmented value={sortKey} options={[{ value: "investment", label: "투자금 낮은 순" }, { value: "rate", label: "하락률 큰 순" }]} onChange={setSortKey} label="후보 정렬" />}
    >
      <div className="frosted overflow-x-auto rounded-lg">
        {sorted.length === 0 ? (
          <div className="px-5 py-10 text-center"><Star className="mx-auto size-5 text-muted-foreground" /><p className="mt-2 text-sm font-semibold">관심 단지가 아직 없어요</p><p className="mt-1 text-[12px] text-muted-foreground">위 매트릭스에서 별을 눌러 후보를 모아보세요.</p></div>
        ) : (
          <table className="w-full min-w-[860px] text-left text-[12px]">
            <thead><tr className="text-muted-foreground"><th className="px-3 py-2.5">단지명</th><th>평형</th><th>연식</th><th className="text-right">세대수</th><th className="text-right">전고점</th><th className="text-right">매매가</th><th className="text-right">전세가</th><th className="text-right">투자금</th><th className="w-10" /></tr></thead>
            <tbody>{sorted.map((candidate) => <tr key={candidate.key} className="border-t border-rule hover:bg-glass"><td className="px-3 py-3"><p className="font-semibold">{candidate.name}</p><p className="text-[10px] text-muted-foreground">{candidate.district} · <span className={candidate.rate !== null && candidate.rate > 0 ? "text-fall" : "text-rise"}>{pct(candidate.rate)}</span></p></td><td>{candidate.type}㎡</td><td>{candidate.builtYear}</td><td className="num text-right">{candidate.households?.toLocaleString("ko-KR") ?? "—"}</td><td className="num text-right">{eok(candidate.peak)}</td><td className="num text-right">{eok(candidate.sale)}</td><td className="num text-right">{eok(candidate.jeonse)}{candidate.estimated ? <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">추정</span> : null}</td><td className="num text-right font-semibold text-primary">{eok(candidate.investment)}</td><td><Button type="button" size="icon" variant="ghost" onClick={() => remove(candidate)} aria-label={`${candidate.name} 관심 해제`} className="size-8"><X /></Button></td></tr>)}</tbody>
          </table>
        )}
      </div>
    </Section>
  );
}

function InvestmentMatrix({ candidates }: { candidates: Candidate[] }) {
  const investmentBands = ["3억 이하", "3~5억", "5~8억", "8~12억", "12억 초과"];
  const saleBands = ["20억 이상", "15~20억", "10~15억", "7~10억", "7억 미만"];
  function investmentIndex(value: number) { return value <= 3 ? 0 : value <= 5 ? 1 : value <= 8 ? 2 : value <= 12 ? 3 : 4; }
  function saleIndex(value: number) { return value >= 20 ? 0 : value >= 15 ? 1 : value >= 10 ? 2 : value >= 7 ? 3 : 4; }
  return (
    <Section eyebrow="Budget × price" title="투자금 × 매매가 매트릭스" description="관심 후보를 매매가대와 필요한 투자금으로 교차해 예산에 맞는 단지를 찾습니다.">
      <div className="frosted overflow-x-auto rounded-lg">
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
          <thead><tr className="text-[11px] text-muted-foreground"><th className="sticky left-0 z-10 border-b border-r border-rule bg-panel-strong px-3 py-2.5">매매가</th>{investmentBands.map((band) => <th key={band} className="border-b border-rule px-3 py-2.5">{band}</th>)}</tr></thead>
          <tbody>{saleBands.map((saleBand, si) => <tr key={saleBand} className="align-top"><th className="sticky left-0 z-10 border-b border-r border-rule bg-panel-strong px-3 py-3 num text-[12px]">{saleBand}</th>{investmentBands.map((investBand, ii) => { const cell = candidates.filter((candidate) => saleIndex(candidate.sale) === si && investmentIndex(candidate.investment) === ii); return <td key={investBand} className="min-w-36 border-b border-rule p-2">{cell.map((candidate) => <div key={candidate.key} className="mb-1 rounded-md border border-rule bg-background/70 p-2 last:mb-0"><p className="truncate text-[11px] font-semibold">{candidate.name}</p><p className="num mt-0.5 text-[10px] text-muted-foreground">{candidate.type}㎡ · {eok(candidate.investment)}</p></div>)}{cell.length === 0 ? <span className="text-muted-foreground/50">—</span> : null}</td>; })}</tr>)}</tbody>
        </table>
      </div>
    </Section>
  );
}

export function MarketDashboard() {
  const [watched, setWatched] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("ledger-real-estate-watchlist");
      if (stored) setWatched(new Set(JSON.parse(stored) as string[]));
    } catch { /* Ignore invalid browser storage. */ }
  }, []);
  function update(next: Set<string>) {
    setWatched(next);
    window.localStorage.setItem("ledger-real-estate-watchlist", JSON.stringify([...next]));
  }
  function toggleWatch(name: string, type: UnitType) {
    const next = new Set(watched);
    const key = `${name}::${type}`;
    if (next.has(key)) next.delete(key); else next.add(key);
    update(next);
  }
  const candidates = [...watched].map((key) => { const split = key.lastIndexOf("::"); return candidateFor(key.slice(0, split), key.slice(split + 2) as UnitType); }).filter((candidate): candidate is Candidate => Boolean(candidate));
  const districts = new Set(DATA.complexes.map((complex) => districtOf(complex))).size;
  const rates = (DATA.bands["84"]?.rows ?? []).flatMap((row) => Object.values(row.cells).flat()).map((entry) => entry.ratePct).filter((value): value is number => typeof value === "number");
  const avgRate = rates.length ? rates.reduce((sum, value) => sum + value, 0) / rates.length : null;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<Building2 />} label="트래킹 단지" value={DATA.complexes.length.toLocaleString("ko-KR")} foot="안테나 단지 월별 시세모음 기준" />
        <Stat icon={<TrendingDown />} label="평균 등락률" value={pct(avgRate)} foot="84㎡ · 전고점 대비" tone={avgRate !== null && avgRate > 0 ? "fall" : "rise"} />
        <Stat icon={<Star />} label="저평가 후보" value={`${candidates.length}개`} foot="관심 표시한 단지" />
        <Stat icon={<WalletCards />} label="기준 월" value={monthLabel(DATA.meta.latestMonth)} foot={`${DATA.meta.months.length}개월 시세 추적`} />
      </div>
      <div className="mt-5"><QuintileTable /><Matrix watched={watched} toggleWatch={toggleWatch} /><TrendChart /><Watchlist candidates={candidates} remove={(candidate) => toggleWatch(candidate.name, candidate.type)} /><InvestmentMatrix candidates={candidates} /></div>
      <p className="pb-8 text-[10px] text-muted-foreground">원본: {DATA.meta.sourceFile} · 가격 단위: 억 원 · 전세 매물이 없는 경우 지역 평균 전세가율을 적용한 추정값입니다.</p>
    </>
  );
}

function Stat({ icon, label, value, foot, tone }: { icon: React.ReactNode; label: string; value: string; foot: string; tone?: "rise" | "fall" }) {
  return <div className="frosted rounded-lg p-4"><div className="flex items-center justify-between text-muted-foreground"><p className="text-[11px] font-semibold">{label}</p><span className="[&_svg]:size-4">{icon}</span></div><p className={cn("num mt-3 font-display text-2xl font-bold", tone === "rise" && "text-rise", tone === "fall" && "text-fall")}>{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{foot}</p></div>;
}
