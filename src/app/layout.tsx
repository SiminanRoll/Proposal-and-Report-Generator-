import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proposal & Report Generator",
  description: "Advantage Technologies report and proposal workspace",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
