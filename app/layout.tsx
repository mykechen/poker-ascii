import type { Metadata } from "next";
import { Source_Code_Pro } from "next/font/google";
import "./globals.css";

const mono = Source_Code_Pro({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "No Limit",
  description: "A local eight-seat no-limit hold'em table.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${mono.variable} ${mono.className}`}>{children}</body>
    </html>
  );
}
