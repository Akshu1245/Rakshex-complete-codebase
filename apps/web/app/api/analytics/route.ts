import { notConnectedHandler } from "../_lib/notConnected";

export const dynamic = "force-dynamic";

const { GET, POST, PUT, PATCH, DELETE } = notConnectedHandler("Analytics");

export { GET, POST, PUT, PATCH, DELETE };
