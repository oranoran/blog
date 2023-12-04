import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import robotsTxt from "astro-robots-txt";
import partytown from "@astrojs/partytown";

import prefetch from "@astrojs/prefetch";

// https://astro.build/config
export default defineConfig({
  site: 'https://www.epelbaum.me',
  integrations: [mdx(), sitemap(), robotsTxt(), partytown({
    config: {
      forward: ["dataLayer.push"]
    }
  }), prefetch()]
});