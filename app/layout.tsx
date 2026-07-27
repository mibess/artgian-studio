import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Artgian Studio | Soluções criativas em impressão 3D",
  description: "Peças personalizadas, presentes, decoração e projetos sob medida produzidos em impressão 3D.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="scroll-smooth" lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[#f7f3ea] font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
