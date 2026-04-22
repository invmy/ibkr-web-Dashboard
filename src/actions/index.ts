import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { getAccounts, getLedger, getPositions } from "../lib/ibkr/api";

const maskAccountId = (id: string) => {
  if (!id || id.length <= 4) return id;
  return `${id.slice(0, 2)}****${id.slice(-2)}`;
};

export const server = {
  getAccounts: defineAction({
    handler: async () => {
      try {
        const data = await getAccounts();
        if (!Array.isArray(data)) {
          return { success: true, data: [] };
        }
        const sanitizedAccounts = data.map((acc: any, index: number) => ({
          index,
          maskedId: maskAccountId(acc.accountId),
          desc: acc.desc,
          currency: acc.currency,
        }));
        return { success: true, data: sanitizedAccounts };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  }),
  getPortfolioData: defineAction({
    input: z.object({
      index: z.number(),
    }),
    handler: async ({ index }) => {
      try {
        const accounts = await getAccounts();
        if (!accounts || !accounts[index]) {
          throw new Error("Invalid account index");
        }
        const accountId = accounts[index].accountId;

        const [ledger, positions] = await Promise.all([
          getLedger(accountId),
          getPositions(accountId),
        ]);

        const baseLedger = ledger.BASE || Object.values(ledger)[0] || {};
        const baseCurrency = baseLedger.currency || "USD";

        // 1. Summary Data
        const summary = {
          totalNetLiquidation: baseLedger.netliquidationvalue || 0,
          realizedPnl: baseLedger.realizedpnl || 0,
          unrealizedPnl: baseLedger.unrealizedpnl || 0,
          interest: baseLedger.interest || 0,
          cash: baseLedger.cashbalance || 0,
          currency: baseCurrency,
        };

        // 2. Asset Allocation Logic
        const getExchangeRate = (curr: string) => {
          if (!curr || curr === "BASE" || curr === baseCurrency) return 1;
          return ledger[curr]?.exchangerate || 1;
        };

        const allocationMap = (positions || []).reduce(
          (acc: Record<string, number>, pos: any) => {
            const assetClass = pos.assetClass || "OTHER";
            const mktValueBase =
              (pos.mktValue || 0) * getExchangeRate(pos.currency);
            acc[assetClass] = (acc[assetClass] || 0) + mktValueBase;
            return acc;
          },
          {},
        );

        if (summary.cash > 0) {
          allocationMap["CASH"] = (allocationMap["CASH"] || 0) + summary.cash;
        }

        const totalValue = Object.values(allocationMap).reduce(
          (a, b) => a + b,
          0,
        );
        const assetAllocation = Object.entries(allocationMap)
          .map(([name, value], index) => ({
            name,
            value,
            percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
            fill: `var(--chart-${(index % 5) + 1})`,
          }))
          .sort((a, b) => b.value - a.value);

        // 3. Holdings Logic
        const holdingsList = (positions || []).map((pos: any) => ({
          symbol: pos.ticker || pos.contractDesc || pos.conid,
          name: pos.name || pos.contractDesc,
          price: pos.mktPrice,
          avgPrice: pos.avgCost || 0,
          unrealizedPnl: pos.unrealizedPnl || 0,
          realizedPnl: pos.realizedPnl || 0,
          shares: pos.position,
          assetClass: pos.assetClass || "OTHER",
          currency: pos.currency,
          ticker: pos.ticker || pos.contractDesc,
          exchange: pos.listingExchange || "NASDAQ",
        }));

        const groupedHoldings = holdingsList.reduce(
          (acc: Record<string, any[]>, holding: any) => {
            const group = holding.assetClass;
            if (!acc[group]) acc[group] = [];
            acc[group].push(holding);
            return acc;
          },
          {},
        );

        // Sort holdings within groups by unrealized P&L
        Object.values(groupedHoldings).forEach((list) => {
          list.sort((a, b) => b.unrealizedPnl - a.unrealizedPnl);
        });

        return {
          success: true,
          data: {
            summary,
            assetAllocation,
            groupedHoldings,
            totalAssetsCount: holdingsList.length,
          },
        };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  }),
};
