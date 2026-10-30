import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CapCut D-Social",
  description: "Social media video editor inspired by CapCut",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-950 text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
