import nextWorker from "./.open-next/worker.js";
import { routeFrontendApi } from "./cloudflare-api-proxy.mjs";
export * from "./.open-next/worker.js";

export default {
  async fetch(request, env, context) {
    const response = await routeFrontendApi(request, env);
    return response ?? nextWorker.fetch(request, env, context);
  },
};
