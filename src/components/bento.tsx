import * as React from "react";
import { Wallet, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

import { useState, useEffect } from "react";
import { actions } from "astro:actions";

const maskAccountId = (id: string) => {
  if (!id || id.length <= 4) return id;
  return `${id.slice(0, 2)}****${id.slice(-2)}`;
};

export function BentoDashboard() {
  // No detailed render log
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
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
            setSelectedIndex(0);
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
      if (selectedIndex === -1) return;
      if (!isBackground) setLoading(true);
      setRefreshStatus("updating");
      try {
        const result = await actions.getPortfolioData({
          index: selectedIndex,
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
    [selectedIndex],
  );

  useEffect(() => {
    if (selectedIndex !== -1) {
      loadPortfolioData();
    }
  }, [selectedIndex, loadPortfolioData]);

  useEffect(() => {
    if (selectedIndex === -1) return;

    let timeoutId: any;

    const scheduleNext = () => {
      // Calculate milliseconds until the next 21s boundary
      const now = Date.now();
      const delay = 21000 - (now % 21000);

      timeoutId = setTimeout(() => {
        loadPortfolioData(true);
        scheduleNext();
      }, delay + 50); // Add a tiny buffer to ensure we've crossed the boundary
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [selectedIndex, loadPortfolioData]);

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

  // UI Data from server
  const summary = portfolioData?.summary || {};
  const assetAllocation = portfolioData?.assetAllocation || [];
  const groupedHoldings = portfolioData?.groupedHoldings || {};
  const totalAssetsCount = portfolioData?.totalAssetsCount || 0;

  const currentTotalAssets = summary.totalNetLiquidation || 0;
  const currentUnrealizedProfit = summary.unrealizedPnl || 0;
  const currentInterest = summary.interest || 0;
  const baseCurrency = summary.currency || "USD";

  const sortedGroupKeys = Object.keys(groupedHoldings).sort();

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
                value={selectedIndex}
                onChange={(e) => setSelectedIndex(parseInt(e.target.value))}
                className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer pr-10 py-2 w-full md:w-72"
              >
                {accounts.map((acc) => (
                  <option
                    key={acc.index}
                    value={acc.index}
                    className="text-foreground bg-popover"
                  >
                    {acc.maskedId} ({acc.currency})
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
                Total Net Liquidation ({baseCurrency})
              </div>
            </div>
            <div className="flex flex-wrap items-baseline gap-4">
              <div className="flex flex-col gap-1">
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-thin tracking-tighter tabular-nums gradient-text line-height-1">
                  {currentTotalAssets.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h1>
              </div>

              {currentInterest !== 0 && (
                <Badge
                  variant="outline"
                  className="text-xs font-black uppercase tracking-widest border-emerald-500/20 text-emerald-500 mb-2"
                >
                  {currentInterest > 0 ? "+" : ""}
                  {formatCurrency(currentInterest, baseCurrency)} INT
                </Badge>
              )}
            </div>
          </ItemContent>
        </Item>

        {/* Asset Allocation Bento with Progress Bars */}
        <div className="grid grid-cols-1 gap-6">
          <Card className="p-8 flex flex-col gap-8 border-muted/60 shadow-sm overflow-hidden hover:border-muted-foreground/20 transition-colors">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-muted/50 rounded-lg">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-xl font-black tracking-tight">
                  Asset Allocation
                </CardTitle>
              </div>
              <CardDescription className="text-[10px] font-black uppercase tracking-[0.15em] opacity-40">
                Distribution by Asset Class
              </CardDescription>
            </div>
            <div className="flex flex-col gap-6">
              {assetAllocation.map((item: any, i: number) => (
                <div key={i} className="flex flex-col gap-2.5 group">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
                      {item.name}
                    </span>
                    <span className="text-xs font-black tabular-nums">
                      {formatCurrency(item.value, baseCurrency)}
                    </span>
                  </div>
                  {item.name !== "CASH" && (
                    <div className="h-1 w-full bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all duration-1000 ease-out"
                        style={{
                          backgroundColor: item.fill,
                          width: `${item.percentage}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Holdings List */}
        <div className="flex flex-col gap-6 mt-4">
          <div className="flex justify-between items-center px-2">
            <div className="flex flex-col gap-1">
              <h2 className="text-3xl font-black tracking-tighter uppercase italic gradient-text">
                Holdings
              </h2>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-[9px] font-black uppercase tracking-widest border-primary/20 text-primary"
                >
                  {totalAssetsCount} ASSETS
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

            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-emerald-500" />
              <div className="flex flex-col items-end">
                <span
                  className={`text-2xl font-black tabular-nums ${currentUnrealizedProfit >= 0 ? "text-emerald-500" : "text-rose-400"}`}
                >
                  {currentUnrealizedProfit >= 0 ? "+" : ""}
                  {formatCurrency(currentUnrealizedProfit, baseCurrency)}
                </span>
                <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest opacity-40">
                  Unrealized PNL
                </span>
              </div>
            </div>
          </div>
          <ItemGroup className="flex flex-col gap-8">
            {sortedGroupKeys.map((assetClass) => (
              <div key={assetClass} className="flex flex-col gap-4">
                <div className="flex items-center gap-4 px-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 whitespace-nowrap">
                    {assetClass}
                  </h3>
                  <div className="h-px w-full bg-gradient-to-r from-muted/80 to-transparent" />
                </div>
                <div className="flex flex-col gap-2">
                  {groupedHoldings[assetClass].map((holding, idx) => (
                    <Item
                      key={`${holding.symbol}-${idx}`}
                      variant="outline"
                      className="transition-all group p-5 border-muted/60 shadow-sm"
                    >
                      <ItemContent className="gap-1 min-w-[180px]">
                        <ItemTitle className="text-xl font-black tracking-tight">
                          {holding.symbol}
                        </ItemTitle>
                        <ItemDescription className="text-xs font-medium text-muted-foreground/70">
                          {holding.name}
                        </ItemDescription>
                      </ItemContent>

                      <div className="flex flex-col items-end gap-1 px-6 w-32 shrink-0 border-l border-muted/50">
                        <div className="font-black text-lg tabular-nums">
                          {holding.shares}
                        </div>
                        <div className="text-xs text-muted-foreground uppercase font-black tracking-widest">
                          {formatCurrency(holding.avgPrice, holding.currency)}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 px-6 w-40 shrink-0 border-l border-muted/50">
                        <div
                          className={`font-black text-lg tabular-nums ${holding.unrealizedPnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                        >
                          {holding.unrealizedPnl >= 0 ? "+" : ""}
                          {formatCurrency(
                            holding.unrealizedPnl,
                            holding.currency,
                          )}
                        </div>
                      </div>

                      <a
                        href={`https://www.bing.com/search?q=site:investing.com+${holding.exchange}+${holding.ticker}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-end gap-1 px-6 w-40 shrink-0 border-l border-muted/50 hover:bg-muted/50 transition-all cursor-pointer"
                      >
                        <div className="font-black text-xl tabular-nums tracking-tighter">
                          {formatCurrency(holding.price, holding.currency)}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase font-black tracking-widest opacity-50">
                          Live Price
                        </div>
                      </a>
                    </Item>
                  ))}
                </div>
              </div>
            ))}
            {totalAssetsCount === 0 && (
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
