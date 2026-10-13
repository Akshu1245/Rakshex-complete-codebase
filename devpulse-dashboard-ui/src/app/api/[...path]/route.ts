import { proxyBackend } from '@/lib/backend-proxy';
export const dynamic = 'force-dynamic';
async function forward(request: Request) { return proxyBackend(request); }
export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
