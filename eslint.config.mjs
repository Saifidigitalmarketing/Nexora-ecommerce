import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { ignores: [".next/**", "node_modules/**", "public/sw.js", "next-env.d.ts"] },
  // Product images come from admin-supplied URLs / Supabase Storage on any host.
  { rules: { "@next/next/no-img-element": "off" } },
];

export default config;
