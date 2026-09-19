/** Tailwind v4 runs through PostCSS under Next, replacing the @tailwindcss/vite plugin. */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
