import { releaseMaturedEscrow } from "../modules/orders/order.service.ts";

/**
 * Moves seller earnings whose 7-day escrow hold has passed from pending to available balance.
 *
 * Runs inside the API process on an interval. Safe with several instances running it at once:
 * each release is an atomic HELD -> RELEASED transition, so a sub-order is only paid out once.
 */
export const startEscrowReleaseJob = (intervalMinutes: number) => {
  if (!intervalMinutes || intervalMinutes <= 0) return () => {};

  let running = false;
  const run = async () => {
    if (running) return; // previous run still going
    running = true;
    try {
      const { releasedCount } = await releaseMaturedEscrow();
      if (releasedCount > 0) console.log(`[escrow] Released ${releasedCount} matured sub-order(s) to seller balances`);
    } catch (err) {
      console.error("[escrow] Matured escrow release failed:", err);
    } finally {
      running = false;
    }
  };

  // First run shortly after boot, then on the interval
  const first = setTimeout(run, 30_000);
  const timer = setInterval(run, intervalMinutes * 60_000);
  first.unref();
  timer.unref();

  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
};
