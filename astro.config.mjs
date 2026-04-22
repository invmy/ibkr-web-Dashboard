// @ts-check
import { defineConfig, envField, memoryCache } from "astro/config";

import tailwindcss from "@tailwindcss/vite";

import react from "@astrojs/react";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react()],
  adapter: cloudflare({
    sessionKVBindingName: "KV",
    imageService: { build: "compile", runtime: "passthrough" },
  }),
  experimental: {
    cache: {
      provider: memoryCache(),
    },
    routeRules: {
      "/_actions/*": { maxAge: 10, swr: 5 },
    },
  },

  env: {
    schema: {
      OAUTH_CONSUMER_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      IBKR_KEY: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      IBKR_KEY_TOKEN: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      IBKR_DHPARAM: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      IBKR_PRIVATE_ENCRYPTION: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      IBKR_PRIVATE_SIGNATURE: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },
});
