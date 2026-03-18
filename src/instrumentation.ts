/**
 * Next.js Instrumentation Hook
 *
 * Called once when the server process starts (both `pnpm dev` and `pnpm start`).
 * We use it to boot the proactive notification worker — a long-lived setInterval
 * that checks for upcoming tasks and pushes Telegram alerts.
 *
 * Why setInterval instead of a cron route?
 *   - Cron routes only fire when the server receives an HTTP request to that URL.
 *   - When running locally, a setInterval lives inside the same Node.js process
 *     as the Next.js dev server and fires reliably as long as your laptop is awake.
 *   - If the laptop sleeps and wakes, the interval auto-resumes — no extra tooling.
 *
 * Guard: only runs in the Node.js runtime (not the Edge runtime / middleware).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startNotificationWorker } = await import(
      "@/lib/notification-worker"
    );
    startNotificationWorker();
  }
}
