import './globals.css';

export const metadata = {
  title: 'Painel da clínica',
  description: 'Agenda, configuração do atendimento e uso do bot',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
