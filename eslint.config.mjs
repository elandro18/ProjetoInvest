import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
  ...nextVitals,
  ...nextTypescript,
  {
    // ADR-004 — o domínio não conhece framework, ORM nem SDK de provedor.
    // Ele expõe ports; as implementações vivem em src/infra/**.
    files: ["src/modules/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next",
              message:
                "ADR-004: src/modules/** é domínio puro e não pode depender de next/*.",
            },
            {
              name: "@prisma/client",
              message:
                "ADR-004: src/modules/** não pode importar @prisma/client. Declare um port e implemente em src/infra/db.",
            },
          ],
          patterns: [
            {
              group: ["next/*"],
              message:
                "ADR-004: src/modules/** é domínio puro e não pode depender de next/*.",
            },
            {
              group: ["@prisma/*"],
              message:
                "ADR-004: src/modules/** não pode importar @prisma/*. Declare um port e implemente em src/infra/db.",
            },
            {
              group: ["@supabase/*"],
              message:
                "ADR-004: src/modules/** não pode importar SDK de provedor. Declare um port e implemente em src/infra/**.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
