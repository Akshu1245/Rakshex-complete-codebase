import { notConnectedHandler } from "../../_lib/notConnected";

export const dynamic = "force-dynamic";

/** GET /api/reports/:id — honest 501 until the Workers API exposes report reads. */
const { GET } = notConnectedHandler("Reports");

export { GET };
