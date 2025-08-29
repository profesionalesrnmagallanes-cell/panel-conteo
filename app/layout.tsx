import React from 'react';

export const metadata = {
  title: "Resultados en tiempo real",
  description: "Next.js + Firebase/Firestore - Conteo por local/mesa/cargo/candidato"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}