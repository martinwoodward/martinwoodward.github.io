import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://woodwardweb.com',
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