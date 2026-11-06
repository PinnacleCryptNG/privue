import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dcap-qvl ships a wasm-bindgen CommonJS module that loads its .wasm via __dirname; keep it unbundled.
  serverExternalPackages: ["@phala/dcap-qvl-node"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
