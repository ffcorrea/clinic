'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Links do menu, com a tela atual destacada
export default function NavLinks({ isAdmin }) {
  const pathname = usePathname();
  const links = [
    ['/agenda', 'Agenda'],
    ['/configuracao', 'Configuração'],
    ['/uso', 'Uso e custos'],
    ['/usuarios', 'Usuários'],
    ...(isAdmin ? [['/clinicas', 'Clínicas']] : []),
  ];

  return (
    <nav className="nav-links">
      {links.map(([href, label]) => (
        <Link key={href} href={href} className={pathname === href || pathname.startsWith(`${href}/`) ? 'active' : ''}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
