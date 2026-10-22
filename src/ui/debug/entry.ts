import { officialProfile } from "../../data/balance/profile";
import { DebugWorld } from "../../game/debug/DebugWorld";
import { DebugPanel } from "./DebugPanel";
import { browserStore } from "./store";

export async function createPreSession(width: number) {
  const store = browserStore();
  let review: ReviewCase | undefined;
  try {
    const raw = window.sessionStorage.getItem(REVIEW_CASE_KEY);
    window.sessionStorage.removeItem(REVIEW_CASE_KEY);
    if (raw) {
      if (raw.length > 2_000_000) throw new Error("人工复核文件不能超过 2 MB");
      const parsed = await parseReviewDocument(JSON.parse(raw));
      if (parsed.kind !== "balance-simulator-case") throw new Error("人工复核需要单局 case");
      review = parsed;
    }
  } catch (error) {
    store.warning = `人工复核未能准备：${error instanceof Error ? error.message : String(error)}`;
  }
  const world = new DebugWorld(
    review?.run.width ?? width,
    review?.profile ?? store.active ?? officialProfile(),
  );
  if (review) world.execute({ type: "profile", profile: review.profile, seed: review.run.seed });
  let panel: DebugPanel | undefined;
  return {
    world,
    attach: () => {
      panel = new DebugPanel(world, store);
      if (review) panel.openReview(review);
    },
    destroy: () => panel?.destroy(),
  };
}

import { parseReviewDocument, REVIEW_CASE_KEY, type ReviewCase } from "../../balance-sim/review";
