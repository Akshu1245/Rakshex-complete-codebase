// app/server/routers/_app.ts — ADD THESE IMPORTS AND ROUTERS

import { costRouter } from "../api/cost";
import { fixRouter } from "../api/fix";
import { githubRouter } from "../api/github";

export const appRouter = router({
  // ... existing routers ...

  // 🔥 NEW: Cost intelligence
  cost: costRouter,

  // 🔥 NEW: Fix suggestions
  fix: fixRouter,

  // 🔥 NEW: GitHub integration
  github: githubRouter,
});
