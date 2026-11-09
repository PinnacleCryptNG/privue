import { after } from "next/server";
import { mirrorOne, recordSkip, copyAccount, type MirrorJob } from "./engine";
import { drain, type Handlers, type Job } from "./jobs";
import { recordRun } from "./ops";

const MAX_ATTEMPTS = 5;

export const HANDLERS: Handlers = {
  mirror: async (p: MirrorJob, job: Job) => {
    try {
      return await mirrorOne(p);
    } catch (e) {
      if (job.attempts >= MAX_ATTEMPTS) await recordSkip(copyAccount(p.holder, p.handle), p.sourceFill, `failed after ${job.attempts} attempts`);
      throw e;
    }
  },
};

export const work = (budgetMs = 50_000) => recordRun("work", () => drain(HANDLERS, { concurrency: 8, budgetMs }));

/** Starts draining right after the response is sent, so a trade returns fast and copiers still fill in seconds. */
export function kick(): void {
  after(() => work(40_000).catch(() => {}));
}
