import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { cn, ThemeProvider, ThemeToggle, Toaster } from "@acme/ui-shared";

import { TRPCReactProvider } from "~/trpc/react";
import { DebugInitializer } from "./_components/debug-initializer";
import { GroupTestDataInitializer } from "./_components/group-test-data-initializer";
import { Navigation } from "./_components/navigation";
import { SessionTestDataInitializer } from "./_components/session-test-data-initializer";
import { IOSSafariFix } from "~/components/IOSSafariFix";

import "~/app/globals.css";

import { env } from "~/env";

export const metadata: Metadata = {
  metadataBase: new URL(
    env.VERCEL_ENV === "production"
      ? "https://app.g1fitnessoc.com"
      : "http://localhost:3000",
  ),
  title: "G1 Fitness",
  description: "Professional fitness training and workout management platform",
  openGraph: {
    title: "G1 Fitness",
    description: "Professional fitness training and workout management platform",
    url: "https://app.g1fitnessoc.com",
    siteName: "G1 Fitness",
  },
  twitter: {
    card: "summary_large_image",
    site: "@g1fitness",
    creator: "@g1fitness",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
          rel="stylesheet"
        />
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
          geistSans.variable,
          geistMono.variable,
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TRPCReactProvider>
            <IOSSafariFix />
            <DebugInitializer />
            <SessionTestDataInitializer />
            <GroupTestDataInitializer />
            {props.children}
          </TRPCReactProvider>
          <div className="fixed bottom-4 right-4 z-50">
            <ThemeToggle />
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
