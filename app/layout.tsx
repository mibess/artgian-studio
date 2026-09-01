import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ||
    requestHeaders.get("host") ||
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim() ||
    (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Artgian Studio | Soluções criativas em impressão 3D";
  const description =
    "Peças personalizadas, presentes, decoração e projetos sob medida produzidos em impressão 3D.";
  const socialImage = new URL("/og.png", origin).toString();

  return {
    title,
    description,
    icons: {
      icon: {
        url: "/favicon.png",
        type: "image/png",
      },
      shortcut: "/favicon.png",
      apple: "/artgian-monogram.png",
    },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Artgian Studio",
      images: [
        {
          url: socialImage,
          width: 1728,
          height: 910,
          alt: "Bandeja Aurora — Artgian Studio",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="scroll-smooth" data-scroll-behavior="smooth" lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[#f7f3ea] font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
