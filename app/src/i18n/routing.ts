/**
 * next-intl routing configuration.
 *
 * @description Defines locale routing behavior for middleware
 *              and navigation helpers.
 */

import { defineRouting } from "next-intl/routing";
import { LOCALES, DEFAULT_LOCALE } from "./config";

export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
});
