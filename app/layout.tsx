import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const geistSans = Geist({
   variable: '--font-geist-sans',
   subsets: ['latin'],
});

const geistMono = Geist_Mono({
   variable: '--font-geist-mono',
   subsets: ['latin'],
});

/**
 * Set this to wherever the app is deployed so link previews resolve. It is only
 * used to build absolute URLs for Open Graph and Twitter cards.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
   title: {
      template: '%s | Circle',
      default: 'Circle',
   },
   description:
      'An issue tracker where people and agents work on the same data. Built on Ablo for realtime multiplayer writes, with Next.js, Drizzle and Better Auth.',
   openGraph: {
      type: 'website',
      locale: 'en_US',
      url: siteUrl,
      siteName: 'Circle',
      images: [
         {
            url: `${siteUrl}/banner.png`,
            width: 2560,
            height: 1440,
            alt: 'Circle',
         },
      ],
   },
   twitter: {
      card: 'summary_large_image',
      images: [
         {
            url: `${siteUrl}/banner.png`,
            width: 2560,
            height: 1440,
            alt: 'Circle',
         },
      ],
   },
   keywords: ['issue tracker', 'agents', 'ablo', 'realtime', 'multiplayer', 'nextjs'],
};

import { ThemeProvider } from '@/components/layout/theme-provider';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

export default function RootLayout({
   children,
}: Readonly<{
   children: React.ReactNode;
}>) {
   return (
      <html lang="en" suppressHydrationWarning>
         <head>
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
         </head>
         <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background`}
            suppressHydrationWarning
         >
            <NuqsAdapter>
               <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
                  {children}
                  <Toaster />
               </ThemeProvider>
            </NuqsAdapter>
         </body>
      </html>
   );
}
