import type { Metadata } from "next";
import "./globals.css";
import LayoutClient from "@/components/layout-client";
import styles from './Layout.module.css';

export const metadata: Metadata = {
  title: "RouterOS Assistant",
  description: "Your AI-powered guide to RouterOS documentation and configuration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={styles.root}>
        <LayoutClient>
            {children}
        </LayoutClient>
      </body>
    </html>
  );
}
