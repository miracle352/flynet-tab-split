import type { Metadata, Viewport } from "next";
// Self-hosted through the `geist` package, so the app renders its own
// type without reaching out to a font CDN at build or runtime.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/auth/currentUser";
import { quoteAt } from "@/price/fly";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Flynet Tab Split: split the check in FLY",
    template: "%s · Flynet Tab Split",
  },
  description:
    "Split a restaurant bill at the table and settle it in FLY. Everyone pays their own share straight to the venue, anchored to a real check-in.",
  applicationName: "Flynet Tab Split",
  keywords: ["split the bill", "FLY", "restaurant", "check-in", "USDT", "wallet"],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0d0c" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // The first paint and the first poll must agree, or every dollar figure
  // on the page flickers on hydration. The member is resolved here for the
  // same reason: the shell should know who is signed in on first paint.
  const [initialQuote, initialUser] = await Promise.all([
    Promise.resolve(quoteAt()),
    getCurrentUser(),
  ]);

  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh">
          <AppShell initialQuote={initialQuote} initialUser={initialUser}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
