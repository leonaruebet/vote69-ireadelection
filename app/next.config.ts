import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * next-intl plugin for i18n support.
 *
 * @description Wraps Next.js config with locale-aware routing.
 *              Request config is loaded from src/i18n/request.ts.
 */
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
};

export default withNextIntl(nextConfig);
