import type { Page } from "@playwright/test";

/** Opt-in software-WebGL scheduling for long controls; simulation stays at 120 Hz. */
export async function configureNaturalRender(page: Page): Promise<void> {
  const requested = process.env.ECHOES_BROWSER_NATURAL_FPS;
  if (!requested) return;
  if (requested !== "15") throw new Error("ECHOES_BROWSER_NATURAL_FPS only accepts 15");
  await page.route(/\/src\/game\/createGame\.ts(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace(
      "fps: { target: 60 }",
      "fps: { target: 15, forceSetTimeOut: true, smoothStep: false }",
    );
    if (body === original) throw new Error("Review the test-only Phaser FPS route target");
    await route.fulfill({ response, body });
  });
  console.log("Natural control environment: Phaser 15 FPS; World fixed step remains 120 Hz");
}
