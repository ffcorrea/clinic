import './globals.css';

export const metadata = {
  title: 'Painel de uso',
  description: 'Mensagens, tokens e custo por consultorio',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
