import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";
import { OrganizationProvider } from "@/lib/org";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "SupportFlow AI",
  description: "AI-native customer support SaaS shell"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <OrganizationProvider>{children}</OrganizationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

