/** Shared Playwright target: local vite preview vs live BASE_URL. */

const LOCAL_URL = "http://127.0.0.1:4173/pacman/";

function deployFlag(): "true" | "false" | "unset" {
  const raw = (process.env.DEPLOY ?? "").trim().toLowerCase();
  if (["false", "0", "no"].includes(raw)) return "false";
  if (["true", "1", "yes"].includes(raw)) return "true";
  return "unset";
}

export type PlaywrightTarget = {
  /** Set only when e2e should hit a remote host (no local webServer). */
  remote: string | undefined;
  baseURL: string;
  local: boolean;
};

/**
 * pacman-ci default is the checkout’s vite preview (testid hooks in dist).
 * Live BASE_URL is opt-in smoke:
 *   - DEPLOY=false / 0 / no → always local (BASE_URL ignored)
 *   - CI=1 → local unless DEPLOY=true (so a leftover playaddatest BASE_URL cannot skip webServer)
 *   - non-CI + BASE_URL → live (manual smoke)
 */
export function resolvePlaywrightTarget(): PlaywrightTarget {
  const remote = process.env.BASE_URL?.trim();
  const deploy = deployFlag();
  const ci = Boolean(process.env.CI);
  let useRemote = Boolean(remote) && deploy !== "false";
  if (ci && deploy !== "true") useRemote = false;
  const base = (useRemote ? remote! : LOCAL_URL).replace(/\/?$/, "/");
  return { remote: useRemote ? remote : undefined, baseURL: base, local: !useRemote };
}

export function isLiveTarget(): boolean {
  return !resolvePlaywrightTarget().local;
}

export const LIVE_SKIP_MESSAGE =
  'Live BASE_URL is missing data-testid="start" — testid hooks are not on the published build. ' +
  "pacman-ci must use local vite preview (DEPLOY=false, or CI without DEPLOY=true). " +
  "Live BASE_URL smoke needs a published build that includes the testid hooks.";

export function logPlaywrightTarget(target: PlaywrightTarget = resolvePlaywrightTarget()): void {
  const requested = process.env.BASE_URL?.trim();
  if (requested && target.local) {
    console.log(
      `[playwright] local preview ${target.baseURL} (CI default / DEPLOY=false; BASE_URL=${requested} ignored)`,
    );
    return;
  }
  if (target.remote) {
    console.log(`[playwright] live smoke ${target.baseURL} (DEPLOY=true or non-CI BASE_URL)`);
  }
}
