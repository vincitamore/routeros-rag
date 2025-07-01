import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import "@/styles/monitoring.css";
import { AuthProvider } from '@/contexts/auth-context';
import { AuthWrapper } from '@/components/auth/auth-wrapper';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RouterOS Network Portal",
  description: "Network monitoring and configuration portal for RouterOS devices",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark:bg-gray-900">
      <body className={`${inter.className} antialiased bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100`}>
        <AuthProvider>
          <AuthWrapper>
            {children}
          </AuthWrapper>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgb(var(--card-rgb))',
                color: 'rgb(var(--foreground-rgb))',
                border: '1px solid rgb(var(--border-rgb))',
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
