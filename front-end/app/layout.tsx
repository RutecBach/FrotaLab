import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'FrotaLab · Gestão de frotas',
  description:
    'Frotas, rotas e entregas em uma operação conectada. Projeto acadêmico de desenvolvimento web.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
