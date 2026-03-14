import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediQueue | Hospital Token Management",
  description: "Modern healthtech token management system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
      </body>
    </html>
  );
}
