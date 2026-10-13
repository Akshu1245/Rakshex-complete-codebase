export const dynamic = 'force-dynamic';
export function GET() {
  const backend = process.env.BACKEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:8000');
  if (!backend) return Response.json({error: 'Backend address is not configured'}, {status: 503});
  try {
    const url = new URL(process.env.NEXT_PUBLIC_WS_URL || backend);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid URL');
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws/health'; url.search = ''; url.hash = '';
    return Response.json({health_websocket_url: url.toString()}, {headers: {'Cache-Control': 'no-store'}});
  } catch {
    return Response.json({error: 'Invalid backend configuration'}, {status: 503});
  }
}
