import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Evita que o Next infira a raiz do workspace a partir de um lockfile fora do
  // repositório (ex.: package-lock.json no diretório home do usuário).
  outputFileTracingRoot: path.resolve(process.cwd()),
};

export default nextConfig;
