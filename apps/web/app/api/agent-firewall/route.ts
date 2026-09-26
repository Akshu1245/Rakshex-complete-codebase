import { notConnectedHandler } from "../_lib/notConnected";

export const dynamic = "force-dynamic";

const { GET, POST, PUT, PATCH, DELETE } = notConnectedHandler("Agent Firewall");

export { GET, POST, PUT, PATCH, DELETE };
