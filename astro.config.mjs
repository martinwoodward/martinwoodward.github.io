import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Canonical host (GitHub Pages CNAME); deploy also passes it via --site.
  site: 'https://www.woodwardweb.com',
  // Sätteri (Astro's default Markdown processor) has GFM built in and can't
  // run unified/remark plugins, so none are configured here.
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'github-dark',
      wrap: true
    }
  },
  integrations: [
    // MDX files import their components explicitly; astro-auto-import was
    // removed because 0.6 re-injects them and causes duplicate declarations.
    react(),
    sitemap({
      // Skip the noindex OG preview and the /author/ -> /about redirect.
      filter: (page) => !/\/(og-preview|author)\/$/.test(page)
    }),
    mdx({
      syntaxHighlight: 'shiki',
      shikiConfig: {
        theme: 'github-dark',
        wrap: true
      }
    })
  ],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ['react-lite-youtube-embed', '@primer/react-brand']
    }
  }
});