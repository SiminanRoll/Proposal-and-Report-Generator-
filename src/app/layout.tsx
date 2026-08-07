import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Client Compass",
  description: "Advantage Technologies project opportunity and client planning workspace",
  icons: {
    icon: "/client-compass-icon.png",
    shortcut: "/client-compass.ico",
    apple: "/client-compass-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
