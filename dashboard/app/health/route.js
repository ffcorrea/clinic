// Health check do App Platform (fora do login)
export function GET() {
  return Response.json({ status: 'ok' });
}
