import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#030712",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "CapCut D-Social",
  description: "Social media video editor inspired by CapCut & OpenCut",
  applicationName: "D-Social Studio",
  appleWebApp: { capable: true, title: "D-Social Studio", statusBarStyle: "black-translucent" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
