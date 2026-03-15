import * as cron from "node-cron";
import { v4 } from "uuid";
import { getPrismaClient } from "@/configs";

export const startAutoIncomeCron = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("[CRON] Checking auto income...");

    const today = new Date();
    const todayDay = today.getDate();

    try {
      const wallets = await getPrismaClient().wallet.findMany({
        where: {
          haveAutomaticIncome: true,
          isActive: true,
          isArchived: false,
          automaticIncomeDay: todayDay,
        },
      });

      console.log(`[CRON] Found ${wallets.length} wallets`);

      for (const wallet of wallets) {
        if (!wallet.automaticIncomeAmount || wallet.automaticIncomeAmount <= 0) continue;

        try {
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

          const existing = await getPrismaClient().transaction.findFirst({
            where: {
              walletId: wallet.id,
              type: "IN",
              description: "Automatic monthly income",
              date: { gte: startOfMonth, lte: endOfMonth },
            },
          });

          if (existing) {
            console.log(`[CRON] Already done for ${wallet.name}`);
            continue;
          }

          await getPrismaClient().transaction.create({
            data: {
              id: v4(),
              type: "IN",
              amount: wallet.automaticIncomeAmount,
              date: today,
              description: "Automatic monthly income",
              walletId: wallet.id,
              accountId: wallet.accountId,
            },
          });

          await getPrismaClient().wallet.update({
            where: { id: wallet.id },
            data: { amount: { increment: wallet.automaticIncomeAmount } },
          });

          console.log(`[CRON] ✅ Done for ${wallet.name} — ${wallet.automaticIncomeAmount}`);
        } catch (e) {
          console.error(`[CRON] Failed for ${wallet.id}:`, e);
        }
      }
    } catch (e) {
      console.error("[CRON] Fatal:", e);
    }
  });

  console.log("[CRON] Auto income cron started");
};