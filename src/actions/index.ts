import { defineAction } from "astro:actions";
import { z } from "astro/zod";
import { getAccounts, getLedger, getPositions } from "../lib/ibkr/api";

export const server = {
  getAccounts: defineAction({
    handler: async () => {
      try {
        const data = await getAccounts();
        return { success: true, data };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  }),
  getPortfolioData: defineAction({
    input: z.object({
      accountId: z.string(),
    }),
    handler: async ({ accountId }) => {
      try {
        const [ledger, positions] = await Promise.all([
          getLedger(accountId),
          getPositions(accountId),
        ]);
        return { success: true, data: { ledger, positions } };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  }),
};
