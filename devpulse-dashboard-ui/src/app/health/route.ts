import { proxyBackend } from '@/lib/backend-proxy';
export const dynamic = 'force-dynamic';
export function GET(request: Request) { return proxyBackend(request, '/health'); }
export const HEAD = GET;
