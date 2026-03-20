import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["react", "react-dom", "@mantine/core", "@mantine/hooks"],
  // We need to inject the CSS imports into the bundle or let tsup extract it
  injectStyle: true, 
  esbuildOptions(options) {
    options.banner = {
      js: '"use client";',
    };
  },
});
