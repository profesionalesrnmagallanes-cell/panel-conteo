import './globals.css';
import { Inter } from 'next/font/google';

export const metadata = {
  title: "Resultados en tiempo real",
  description: "Next.js + Firebase/Firestore - Conteo por local/mesa/cargo/candidato"
};

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
