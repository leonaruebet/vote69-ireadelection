/**
 * Next.js middleware for i18n locale detection and URL routing.
 *
 * @description Uses next-intl to detect the user's preferred locale
 *              from Accept-Language header or URL prefix, and redirects
 *              to the appropriate locale path.
 */

import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: [
    "/",
    "/(th|en|lo|vi|zh|de|ja|ko|fr|sv|id)/:path*",
  ],
};
