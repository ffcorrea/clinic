import { NextResponse } from 'next/server';

// Login simples (Basic Auth) com DASHBOARD_USER / DASHBOARD_PASSWORD
export function proxy(request) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const user = process.env.DASHBOARD_USER || 'admin';
  const header = request.headers.get('authorization') || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded && atob(encoded) === `${user}:${password}`) {
    return NextResponse.next();
  }

  return new NextResponse('Autenticacao necessaria', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Painel de uso"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
