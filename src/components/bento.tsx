import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import {
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  DollarSign,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemMedia,
  ItemContent,
  ItemActions,
  ItemGroup,
  ItemTitle,
  ItemDescription,
} from "@/components/ui/item";

const chartConfig = {
  amount: { label: "金额", color: "var(--chart-1)" },
} satisfies ChartConfig;

import { useState, useEffect } from "react";
import { actions } from "astro:actions";

const maskAccountId = (id: string) => {
  if (!id || id.length <= 4) return id;
  return `${id.slice(0, 2)}****${id.slice(-2)}`;
};

const TradingViewWidget = React.memo(({ symbol }: { symbol: string }) => {
  const container = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML =
      '<div class="tradingview-widget-container__widget"></div>';
    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol,
      colorTheme: "dark",
      isTransparent: true,
      locale: "en",
      width: "100%",
    });
    container.current.appendChild(script);
  }, [symbol]);

  return (
    <div className="tradingview-widget-container" ref={container}>
      <div className="tradingview-widget-container__widget"></div>
    </div>
  );
});

export function BentoDashboard() {
  // No detailed render log
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<
    "idle" | "updating" | "error"
  >("idle");

  useEffect(() => {
    async function loadAccounts() {
      try {
        const result = await actions.getAccounts();
        const { data, error } = result;

        if (error) {
          console.error("Failed to fetch accounts (Action Error):", error);
          setError(error.message);
        } else if (data?.success) {
          setAccounts(data.data);
          if (data.data && data.data.length > 0) {
            setSelectedAccountId(data.data[0].accountId);
          } else {
            console.warn("[BentoDashboard] No accounts found");
          }
        } else {
          console.error(
            "Failed to fetch accounts (Business Error):",
            data?.error,
          );
          setError(data?.error || "Unknown business error");
        }
      } catch (e: any) {
        console.error("[BentoDashboard] Exception in loadAccounts:", e);
        setError(e.message);
      }
      setLoading(false);
    }
    loadAccounts();
  }, []);

  const loadPortfolioData = React.useCallback(
    async (isBackground = false) => {
      if (!selectedAccountId) return;
      if (!isBackground) setLoading(true);
      setRefreshStatus("updating");
      try {
        const result = await actions.getPortfolioData({
          accountId: selectedAccountId,
        });
        const { data, error } = result;

        if (error) {
          console.error(
            "Failed to fetch portfolio data (Action Error):",
            error,
          );
          setError(error.message);
          setRefreshStatus("error");
        } else if (data?.success) {
          setPortfolioData(data.data);
          setError(null);
          setLastUpdated(new Date());
          setRefreshStatus("idle");
        } else {
          console.error(
            "Failed to fetch portfolio data (Business Error):",
            data?.error,
          );
          setError(data?.error || "Unknown error");
          setRefreshStatus("error");
        }
      } catch (e: any) {
        console.error("[BentoDashboard] Exception in loadPortfolioData:", e);
        setError(e.message);
        setRefreshStatus("error");
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [selectedAccountId],
  );

  useEffect(() => {
    if (selectedAccountId) {
      loadPortfolioData();
    }
  }, [selectedAccountId, loadPortfolioData]);

  useEffect(() => {
    if (!selectedAccountId) return;

    let timeoutId: any;

    const scheduleNext = () => {
      // Calculate milliseconds until the next 11s boundary
      const now = Date.now();
      const delay = 11000 - (now % 11000);

      timeoutId = setTimeout(() => {
        loadPortfolioData(true);
        scheduleNext();
      }, delay + 50); // Add a tiny buffer to ensure we've crossed the boundary
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [selectedAccountId, loadPortfolioData]);

  const formatCurrency = (value: number, curr: string) => {
    try {
      // IBKR sometimes returns 'BASE' as currency for ledger entries.
      // We should use the account's base currency or default to USD.
      const safeCurr = !curr || curr === "BASE" ? "USD" : curr;
      return value.toLocaleString(undefined, {
        style: "currency",
        currency: safeCurr,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch (e) {
      return value.toFixed(2);
    }
  };

  if (loading && !portfolioData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Process data for UI
  const ledger = portfolioData?.ledger || {};
  // BASE contains the rolled-up values already converted to base currency
  const baseLedger = ledger.BASE || Object.values(ledger)[0] || {};

  const currentTotalAssets = baseLedger.netliquidationvalue || 0;
  const currentRealizedProfit = baseLedger.realizedpnl || 0;
  const currentUnrealizedProfit = baseLedger.unrealizedpnl || 0;
  const currentInterest = baseLedger.interest || 0;

  // Exchange rate helper: convert position currency to base currency
  const getExchangeRate = (curr: string) => {
    if (!curr || curr === "BASE" || curr === baseLedger.currency) return 1;
    return ledger[curr]?.exchangerate || 1;
  };

  // Compute pie slices per asset class; accumulate total holdings in base currency
  let totalHoldingsBase = 0;
  const currentPieData: any[] =
    portfolioData?.positions?.reduce((acc: any[], pos: any) => {
      const assetClassStr = pos.assetClass || "OTHER";
      // Convert market value to base currency
      const mktValueBase = (pos.mktValue || 0) * getExchangeRate(pos.currency);
      totalHoldingsBase += mktValueBase;

      const existing = acc.find((i) => i.name === assetClassStr);
      if (existing) {
        existing.value += mktValueBase;
      } else {
        acc.push({
          name: assetClassStr,
          value: mktValueBase,
          fill: `var(--chart-${acc.length + 1})`,
        });
      }
      return acc;
    }, []) || [];

  // Cash = Total Net Liquidation − Total Holdings (base currency)
  // This approach guarantees: holdings + cash = net liquidation value
  const derivedCash = currentTotalAssets - totalHoldingsBase;
  if (derivedCash > 0) {
    currentPieData.push({
      name: "CASH",
      value: derivedCash,
      fill: "var(--chart-5)",
    });
  }

  const currentBarData = Object.keys(ledger)
    .filter((k) => k !== "BASE")
    .map((k) => ({
      currency: k,
      amount: ledger[k].netliquidationvalue || 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const currentHoldings =
    portfolioData?.positions?.map((pos: any) => ({
      symbol: pos.ticker || pos.contractDesc || pos.conid,
      name: pos.name || pos.contractDesc,
      price: formatCurrency(pos.mktPrice, pos.currency),
      avgPrice: formatCurrency(pos.avgCost || 0, pos.currency),
      unrealizedPnl: formatCurrency(pos.unrealizedPnl || 0, pos.currency),
      unrealizedPnlRaw: pos.unrealizedPnl || 0,
      change:
        pos.unrealizedPnl > 0
          ? `+${pos.unrealizedPnl.toFixed(2)}`
          : pos.unrealizedPnl.toFixed(2),
      marketValue: formatCurrency(pos.mktValue, pos.currency),
      shares: pos.position,
      assetClass: pos.assetClass,
      // Use listingExchange if available, fallback to NASDAQ
      tvSymbol: `${pos.listingExchange || "NASDAQ"}:${pos.ticker || pos.contractDesc}`,
    })) || [];

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-20 flex flex-col gap-6">
        {/* Account Selector & Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
          <div>
            <h2 className="text-3xl font-black tracking-tighter uppercase italic gradient-text">
              Portfolio Analyst
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              Interactive Brokers Live Data
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 w-full md:w-auto">
            <div className="flex items-center gap-3 bg-muted/50 p-1.5 rounded-2xl border border-muted w-full md:w-auto">
              <Wallet className="w-4 h-4 ml-3 text-muted-foreground" />
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer pr-10 py-2 w-full md:w-72"
              >
                {accounts.map((acc) => (
                  <option
                    key={acc.accountId}
                    value={acc.accountId}
                    className="text-foreground bg-popover"
                  >
                    {maskAccountId(acc.desc || acc.accountId)} ({acc.currency})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3 px-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    refreshStatus === "updating"
                      ? "bg-amber-500 animate-pulse"
                      : refreshStatus === "error"
                        ? "bg-rose-500"
                        : "bg-emerald-500"
                  }`}
                ></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70">
                  {refreshStatus === "updating"
                    ? "Updating..."
                    : refreshStatus === "error"
                      ? "Update Failed"
                      : "System Live"}
                </span>
              </div>
              {lastUpdated && (
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                  Last: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 text-rose-500 text-sm font-medium">
            <Activity className="w-5 h-5" />
            <span>Error: {error}</span>
          </div>
        )}

        <Item
          variant="outline"
          className="md:col-span-3 lg:col-span-4 p-6 sm:p-10 h-full flex items-center shadow-sm"
        >
          <ItemContent className="gap-2 overflow-hidden">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-50">
                Total Net Liquidation (
                {baseLedger.currency && baseLedger.currency !== "BASE"
                  ? baseLedger.currency
                  : "USD"}
                )
              </div>
            </div>
            <div className="flex flex-wrap items-baseline gap-4">
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-thin tracking-tighter tabular-nums gradient-text line-height-1">
                {currentTotalAssets.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h1>
              {currentInterest !== 0 && (
                <Badge
                  variant="outline"
                  className="text-xs font-black uppercase tracking-widest border-emerald-500/20 text-emerald-500 mb-2"
                >
                  {currentInterest > 0 ? "+" : ""}
                  {formatCurrency(currentInterest, baseLedger.currency)} INT
                </Badge>
              )}
            </div>
            <div className="flex gap-6 mt-4">
              <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-500 bg-emerald-500/5 px-3 py-1.5 rounded-full border border-emerald-500/10">
                <ArrowUpRight className="w-4 h-4" />
                <span>
                  {formatCurrency(currentRealizedProfit, baseLedger.currency)}
                </span>
                <span className="text-[9px] opacity-70 uppercase font-black ml-1">
                  Realized
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-400 bg-emerald-400/5 px-3 py-1.5 rounded-full border border-emerald-400/10">
                <Activity className="w-4 h-4 text-emerald-500" />
                <span>
                  {formatCurrency(currentUnrealizedProfit, baseLedger.currency)}
                </span>
                <span className="text-[9px] opacity-70 uppercase font-black ml-1">
                  Unrealized
                </span>
              </div>
            </div>
          </ItemContent>
        </Item>

        {/* 第二行: 资产比例 (Pie) 与 币种分布 (Bar) */}
        <Card className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-muted/60 shadow-sm overflow-hidden">
          <div className="p-8 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                <div className="w-2 h-6 bg-primary rounded-full"></div>
                Asset Allocation
              </CardTitle>
              <CardDescription className="text-xs font-medium uppercase tracking-wider opacity-60">
                Distribution by Asset Class
              </CardDescription>
            </div>
            <div className="h-[280px] w-full">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={currentPieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {currentPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    height={40}
                    iconType="circle"
                    formatter={(value) => (
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ChartContainer>
            </div>
          </div>
          <div className="p-8 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                <div className="w-2 h-6 bg-emerald-500 rounded-full"></div>
                Currency Breakdown
              </CardTitle>
              <CardDescription className="text-xs font-medium uppercase tracking-wider opacity-60">
                Net Liquidation per Currency
              </CardDescription>
            </div>
            <div className="h-[300px] w-full pt-4 pr-10">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <BarChart
                  data={currentBarData}
                  layout="vertical"
                  margin={{ left: 0, right: 20 }}
                  barSize={24}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="currency"
                    type="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fontWeight: 900 }}
                    width={50}
                  />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar
                    dataKey="amount"
                    fill="var(--color-amount)"
                    radius={[0, 4, 4, 0]}
                  >
                    <LabelList
                      dataKey="amount"
                      position="right"
                      offset={12}
                      className="fill-foreground text-[10px] font-black font-mono"
                      formatter={(value: number) =>
                        value > 1000
                          ? `$${(value / 1000).toFixed(1)}k`
                          : `$${value.toFixed(0)}`
                      }
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </Card>

        {/* 第三行开始: 持仓列表 */}
        <div className="flex flex-col gap-6 mt-4">
          <div className="flex justify-between items-end px-2">
            <div className="flex flex-col gap-1">
              <h2 className="text-3xl font-black tracking-tighter uppercase italic gradient-text">
                Holdings
              </h2>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary"
                >
                  {currentHoldings.length} ASSETS
                </Badge>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-40">
                    Auto-refresh every 11s
                  </span>
                </div>
              </div>
            </div>
          </div>
          <ItemGroup className="flex flex-col gap-2">
            {currentHoldings.map((holding, idx) => (
              <Item
                key={`${holding.symbol}-${idx}`}
                variant="outline"
                className="hover:bg-muted/30 transition-all cursor-pointer group p-5 border-muted/60 shadow-sm"
              >
                <ItemContent className="gap-1 min-w-[180px]">
                  <div className="flex items-center gap-2">
                    <ItemTitle className="text-xl font-black tracking-tight">
                      {holding.symbol}
                    </ItemTitle>
                    <Badge
                      variant="secondary"
                      className="text-[9px] h-4 px-2 font-black uppercase tracking-tighter"
                    >
                      {holding.assetClass}
                    </Badge>
                  </div>
                  <ItemDescription className="text-xs font-medium text-muted-foreground/70">
                    {holding.name}
                  </ItemDescription>
                </ItemContent>

                <div className="flex flex-col items-end gap-1 px-6 min-w-32 border-x border-muted/50">
                  <div className="font-black text-lg tabular-nums">
                    {holding.shares}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase font-black tracking-widest">
                    {holding.avgPrice}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 px-6 min-w-32 border-l border-muted/50 ml-auto">
                  <div
                    className={`font-black text-lg tabular-nums ${holding.unrealizedPnlRaw >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                  >
                    {holding.unrealizedPnlRaw >= 0 ? "+" : ""}
                    {holding.unrealizedPnl}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase font-black tracking-widest">
                    {holding.price}
                  </div>
                </div>

                <div className="flex-1 px-4 hidden md:block max-w-[240px] border-l border-muted/50">
                  <TradingViewWidget symbol={holding.tvSymbol} />
                </div>
              </Item>
            ))}
            {currentHoldings.length === 0 && (
              <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-muted">
                <Activity className="w-10 h-10 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                  No positions found for this account
                </p>
              </div>
            )}
          </ItemGroup>
        </div>
      </div>
    </div>
  );
}
