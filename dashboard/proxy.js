import { NextResponse } from 'next/server';
import { readToken } from './lib/token';

// Toda pagina exige sessao, menos /login e /health
export function proxy(request) {
  if (readToken(request.cookies.get('sid')?.value)) return NextResponse.next();
  return NextResponse.redirect(new URL(`${request.nextUrl.basePath}/login`, request.url));
}

export const config = {
  // '/' explicito: com basePath, a raiz (/painel) nao casa com o padrao de baixo
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico|health|login).*)'],
};
