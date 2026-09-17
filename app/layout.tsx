import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "../lib/site-url";
import "./globals.css";
import { getPublicProductCatalog } from "../lib/products/repository";
import { ProductCatalogProvider } from "../lib/products/context";

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const origin = SITE_URL;
  const title = "Artgian Studio | Soluções criativas em impressão 3D";
  const description =
    "Peças personalizadas, presentes, decoração e projetos sob medida produzidos em impressão 3D.";
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: new URL(origin),
    verification: {
      google: "vqqFd7QDvBus-3BukNxWI38DBMEI6T-64HF3wQTlcE8",
    },
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="scroll-smooth" data-scroll-behavior="smooth" lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[#f7f3ea] font-sans antialiased`}
      >
        <ProductCatalogProvider catalog={await getPublicProductCatalog()}>{children}</ProductCatalogProvider>
      </body>
    </html>
  );
}
