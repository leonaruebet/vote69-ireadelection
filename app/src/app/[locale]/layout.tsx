import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Thai } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ThemeProvider } from "@/lib/theme";
import "../globals.css";

/**
 * Noto Sans Thai - primary font for Thai script.
 *
 * @description Loaded via next/font/google for zero-layout-shift.
 *              Applied as CSS variable --font-noto-thai.
 */
const noto_sans_thai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

/**
 * Noto Sans - fallback font for Latin, CJK, and other scripts.
 *
 * @description Applied as CSS variable --font-noto-sans.
 */
const noto_sans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

/**
 * Generate metadata with translated title/description.
 *
 * @param params - Route params containing locale.
 * @returns Metadata object for the page.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    title: messages.meta.title,
    description: messages.meta.description,
  };
}

/**
 * Generate static params for all supported locales.
 *
 * @returns Array of locale param objects for SSG.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * Root layout wrapper with i18n, font, and theme providers.
 *
 * @param children - Page content to render within the layout.
 * @param params - Route params containing locale.
 * @returns HTML document with fonts, i18n, and theme applied.
 */
export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();

  console.log(`[layout] Rendering locale layout for: ${locale}`);

  return (
    <html
      lang={locale}
      className={`${noto_sans_thai.variable} ${noto_sans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'light') {
                    document.documentElement.classList.add('light');
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  }
                } catch(e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className="antialiased"
      >
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
