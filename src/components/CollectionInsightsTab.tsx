import React from "react";
import { normalizeDiscogsGenre } from "../utils/genre";
import {
  BarChart3,
  TrendingUp,
  Award,
  DollarSign,
  PieChart as PieIcon,
  Library,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Disc3
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid
} from "recharts";
import { ShelfItem } from "../types";
import { useCountUp } from "../hooks/useCountUp";

interface CollectionInsightsTabProps {
  shelfItems: ShelfItem[];
  onGoToScan: () => void;
}

export const CollectionInsightsTab: React.FC<CollectionInsightsTabProps> = ({
  shelfItems,
  onGoToScan,
}) => {
  // Portfolio totals computed unconditionally (even when empty, reduce()
  // just yields 0) so the count-up hooks below can be called before any
  // early return, keeping hook order stable across renders.
  const totalCount = shelfItems.length;
  const totalLow = shelfItems.reduce((sum, item) => sum + (item.calculatedValue?.low || 0), 0);
  const totalMedian = shelfItems.reduce((sum, item) => sum + (item.calculatedValue?.median || 0), 0);
  const totalHigh = shelfItems.reduce((sum, item) => sum + (item.calculatedValue?.high || 0), 0);
  const totalInvestment = shelfItems.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
  const itemsWithPrice = shelfItems.filter((i) => i.purchasePrice !== undefined && i.purchasePrice > 0);
  const totalCostKnown = itemsWithPrice.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
  const totalValKnown = itemsWithPrice.reduce((sum, item) => sum + (item.calculatedValue?.median || 0), 0);
  const netGain = totalValKnown - totalCostKnown;
  const avgRecordValue = totalCount > 0 ? Math.round(totalMedian / totalCount) : 0;

  const animatedTotalMedian = Math.round(useCountUp(totalMedian));
  const animatedAvgValue = Math.round(useCountUp(avgRecordValue));
  const animatedInvestment = Math.round(useCountUp(totalInvestment));
  const animatedNetGain = Math.round(useCountUp(netGain));

  if (!shelfItems || shelfItems.length === 0) {
    return (
      <div className="p-12 text-center rounded-lg bg-[#161616] border border-[#D4AF37]/20 max-w-md mx-auto space-y-4 my-8 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 flex items-center justify-center mx-auto">
          <BarChart3 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white font-serif">No Analytics Available Yet</h3>
        <p className="text-xs font-mono text-zinc-400 leading-relaxed">
          Add vinyl records to "My Shelf" to unlock live collection valuation trends, condition breakdowns, and genre analytics.
        </p>
        <button
          onClick={onGoToScan}
          className="px-6 py-2.5 rounded bg-[#D4AF37] hover:bg-[#FFBF00] text-black font-bold uppercase text-xs tracking-widest flex items-center gap-2 mx-auto shadow-lg transition"
        >
          <Sparkles className="w-4 h-4" />
          <span>Scan Vinyl Records</span>
        </button>
      </div>
    );
  }

  // 2. Data for Valuation Range Chart
  const valuationBarData = [
    { name: "Low Est.", Value: totalLow },
    { name: "Median Value", Value: totalMedian },
    { name: "High Est.", Value: totalHigh },
  ];

  // 3. Data for Genre & Style Distribution
  const genreCounts: Record<string, number> = {};
  const styleCounts: Record<string, number> = {};

  shelfItems.forEach((item) => {
    const norm = normalizeDiscogsGenre(item.genre, item.styles);
    genreCounts[norm.genre] = (genreCounts[norm.genre] || 0) + 1;
    norm.styles.forEach((st) => {
      styleCounts[st] = (styleCounts[st] || 0) + 1;
    });
  });

  const genreChartData = Object.keys(genreCounts).map((key) => ({
    name: key,
    value: genreCounts[key],
  }));

  const topStyles = Object.entries(styleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // 4. Data for Condition Distribution (Media)
  const conditionCounts: Record<string, number> = {};
  shelfItems.forEach((item) => {
    const g = item.mediaGrade || "VG+";
    conditionCounts[g] = (conditionCounts[g] || 0) + 1;
  });

  const conditionChartData = Object.keys(conditionCounts).map((key) => ({
    name: `Grade ${key}`,
    value: conditionCounts[key],
  }));

  const COLORS = ["#D4AF37", "#FFBF00", "#997A15", "#B38F24", "#66520E", "#E5C158"];

  // 5. Collection value over time — a running total of estimated value as records were
  // acquired, sorted by "Added" date. This tracks how the collection's value grew as it
  // was built (acquisition order), not fluctuations in an already-owned item's market
  // price over time — the app doesn't take periodic re-valuation snapshots, so a true
  // "market price history" chart isn't something honest data supports yet.
  const valueOverTimeData = [...shelfItems]
    .filter((i) => i.addedAt)
    .sort((a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime())
    .reduce<{ date: string; value: number }[]>((acc, item) => {
      const prevValue = acc.length > 0 ? acc[acc.length - 1].value : 0;
      acc.push({
        date: new Date(item.addedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }),
        value: prevValue + (item.calculatedValue?.median || 0),
      });
      return acc;
    }, []);

  // 5. Top 5 Most Valuable
  const topValuable = [...shelfItems]
    .sort((a, b) => (b.calculatedValue?.median || 0) - (a.calculatedValue?.median || 0))
    .slice(0, 5);

  return (
    <div className="space-y-8 pb-12">
      {/* Metric Cards Bento Grid — the portfolio total is the headline number, so it gets
          double width and a rotating gradient border; the gain/loss card runs full width
          along the bottom since it's the second most important read at a glance. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="border-beam sm:col-span-2 lg:col-span-2 p-6 rounded-lg bg-[#161616] border border-[#D4AF37]/20 shadow-2xl flex flex-col justify-center"
          style={{ ["--beam-color" as any]: "rgba(212, 175, 55, 0.9)" }}
        >
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 block">
            Portfolio Total Value
          </span>
          <div className="text-4xl font-serif font-bold text-[#FFBF00] mt-1.5 tabular-nums">
            S${animatedTotalMedian.toLocaleString()}
          </div>
          <span className="text-[10px] font-mono text-zinc-500 block mt-1.5">
            Est: S${totalLow.toLocaleString()} - S${totalHigh.toLocaleString()}
          </span>
        </div>

        <div className="p-5 rounded-lg bg-[#161616] border border-[#D4AF37]/20 shadow-2xl">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 block">
            Average Value / Album
          </span>
          <div className="text-2xl font-serif font-bold text-white mt-1 tabular-nums">
            S${animatedAvgValue}
          </div>
          <span className="text-[10px] font-mono text-[#D4AF37] block mt-1">
            Across {totalCount} Catalogued Albums
          </span>
        </div>

        <div className="p-5 rounded-lg bg-[#161616] border border-[#D4AF37]/20 shadow-2xl">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 block">
            Logged Purchase Cost
          </span>
          <div className="text-2xl font-serif font-bold text-zinc-300 mt-1 tabular-nums">
            S${animatedInvestment.toLocaleString()}
          </div>
          <span className="text-[10px] font-mono text-zinc-500 block mt-1">
            {itemsWithPrice.length} items logged
          </span>
        </div>

        <div className="sm:col-span-2 lg:col-span-4 p-5 rounded-lg bg-[#161616] border border-[#D4AF37]/20 shadow-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Estimated Value Gain
            </span>
            <span className="text-[10px] font-mono text-zinc-500 block mt-1">
              Based on logged prices
            </span>
          </div>
          <div className={`text-3xl font-serif font-bold tabular-nums ${netGain >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {netGain >= 0 ? `+S$${animatedNetGain.toLocaleString()}` : `-S$${Math.abs(animatedNetGain).toLocaleString()}`}
          </div>
        </div>
      </div>

      {/* Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Valuation Range Distribution Bar Chart */}
        <div className="p-6 rounded-lg bg-[#161616] border border-[#D4AF37]/20 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#D4AF37]" />
              <h3 className="font-serif font-bold text-white text-base">Valuation Spread (Low / Median / High)</h3>
            </div>
            <span className="text-xs font-mono text-[#D4AF37]">S${totalMedian} Total</span>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valuationBarData}>
                <XAxis dataKey="name" stroke="#888888" fontSize={11} fontFamily="JetBrains Mono" />
                <YAxis stroke="#888888" fontSize={11} fontFamily="JetBrains Mono" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0C0C0C", borderColor: "#D4AF37", borderRadius: "4px", color: "#FFBF00", fontFamily: "JetBrains Mono" }}
                  formatter={(val: number) => [`S$${val.toLocaleString()}`, "Valuation"]}
                />
                <Bar dataKey="Value" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Condition Quality Breakdown Pie Chart */}
        <div className="p-6 rounded-lg bg-[#161616] border border-[#D4AF37]/20 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
              <h3 className="font-serif font-bold text-white text-base">Media Condition Breakdown</h3>
            </div>
            <span className="text-xs font-mono text-zinc-400">Goldmine Standards</span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={conditionChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {conditionChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#0C0C0C", borderColor: "#D4AF37", borderRadius: "4px", color: "#fff", fontFamily: "JetBrains Mono" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px", color: "#a1a1aa", fontFamily: "JetBrains Mono" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Collection Value Over Time */}
      {valueOverTimeData.length > 1 && (
        <div className="p-6 rounded-lg bg-[#161616] border border-[#D4AF37]/20 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
              <h3 className="font-serif font-bold text-white text-base">Collection Value Over Time</h3>
            </div>
            <span className="text-xs font-mono text-zinc-400">By acquisition order</span>
          </div>
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={valueOverTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="date" stroke="#888888" fontSize={10} fontFamily="JetBrains Mono" interval="preserveStartEnd" />
                <YAxis stroke="#888888" fontSize={11} fontFamily="JetBrains Mono" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0C0C0C", borderColor: "#D4AF37", borderRadius: "4px", color: "#FFBF00", fontFamily: "JetBrains Mono" }}
                  formatter={(val: number) => [`S$${val.toLocaleString()}`, "Cumulative Value"]}
                />
                <Line type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top 5 Most Valuable Pressings Leaderboard */}
      <div className="p-6 rounded-lg bg-[#161616] border border-[#D4AF37]/20 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#D4AF37]" />
            <h3 className="font-serif font-bold text-white text-base">Top 5 Most Valuable Pressings</h3>
          </div>
          <span className="text-xs font-mono text-[#D4AF37]">Ranked by Median Value</span>
        </div>

        <div className="space-y-3">
          {topValuable.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3.5 rounded bg-black/40 border border-white/5 hover:border-[#D4AF37]/40 transition"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="font-serif font-bold text-[#D4AF37] text-lg w-6 text-center">
                  #{index + 1}
                </span>
                {item.coverArtUrl ? (
                  <img
                    src={item.coverArtUrl}
                    alt={item.albumTitle}
                    className="w-12 h-12 rounded object-cover border border-white/10 shadow"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-black/40 border border-white/10 shadow flex items-center justify-center flex-shrink-0">
                    <Disc3 className="w-5 h-5 text-[#D4AF37]/50" />
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="font-serif font-bold text-sm text-white truncate">{item.albumTitle}</h4>
                  <p className="text-xs font-serif text-[#D4AF37] truncate">{item.artist}</p>
                  <span className="text-[10px] text-zinc-500 font-mono">{item.catalogueNumber}</span>
                </div>
              </div>

              <div className="text-right flex-shrink-0 font-mono">
                <div className="text-base font-serif font-bold text-[#FFBF00]">
                  S${item.calculatedValue?.median}
                </div>
                <div className="text-[10px] text-zinc-500">
                  Grade: {item.mediaGrade} / {item.sleeveGrade}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

