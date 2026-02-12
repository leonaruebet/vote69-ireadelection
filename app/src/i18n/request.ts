/**
 * next-intl server request configuration.
 *
 * @description Loads the appropriate message bundle for the current
 *              request locale. Used by NextIntlClientProvider in layout.
 */

import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  console.log("[i18n] Loading messages for request locale...");

  let locale = await requestLocale;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  const messages = (await import(`../messages/${locale}.json`)).default;
  console.log(`[i18n] Loaded messages for locale: ${locale}`);

  return { locale, messages };
});
