import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Feature Boundary Enforcement Rules
 *
 * Prevents features from importing directly from other features.
 * Features should use @/domain/, @/lib/hooks/, or @/lib/ instead.
 *
 * ARCHITECTURE PRINCIPLES (DDD + Clean Architecture):
 * - Domain Isolation: Shared domain types live in @/domain/
 * - Inversion of Control: Features depend on interfaces, not concrete implementations
 * - Orchestrator Pattern: Complex data needs use Context/Hooks from @/lib/
 */
const featureBoundaryRules = {
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        {
          group: ["@/features/accounts/hooks/*", "@/features/accounts/domain/*", "@/features/accounts/services/*"],
          message: "Import from @/domain/accounts, @/lib/hooks/use-reference-data, or @/lib/ instead of directly from features/accounts."
        },
        {
          group: ["@/features/categories/hooks/*", "@/features/categories/domain/*", "@/features/categories/services/*"],
          message: "Import from @/domain/categories, @/lib/hooks/use-reference-data, or @/lib/ instead of directly from features/categories."
        },
        {
          group: ["@/features/inbox/hooks/*", "@/features/inbox/domain/*", "@/features/inbox/services/*"],
          message: "Import from @/domain/inbox, @/lib/hooks/use-inbox-operations, or @/lib/ instead of directly from features/inbox."
        },
        {
          group: ["@/features/currencies/hooks/*", "@/features/currencies/domain/*", "@/features/currencies/services/*"],
          message: "Import from @/lib/hooks/use-reference-data instead of directly from features/currencies."
        }
      ]
    }]
  }
};

/**
 * Feature-specific overrides
 * Allow features to import their own internals
 */
const featureOverrides = [
  // Accounts feature can import its own internals
  {
    files: ["features/accounts/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // Categories feature can import its own internals
  {
    files: ["features/categories/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // Inbox feature can import its own internals
  {
    files: ["features/inbox/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // Currencies feature can import its own internals
  {
    files: ["features/currencies/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // Reconciliations feature can import its own internals
  {
    files: ["features/reconciliations/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // Transactions feature can import its own internals
  {
    files: ["features/transactions/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // Settings feature can import its own internals
  {
    files: ["features/settings/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // Auth feature can import its own internals
  {
    files: ["features/auth/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // Import/Export feature can import its own internals
  {
    files: ["features/import-export/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // Shared feature can import its own internals
  {
    files: ["features/shared/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // lib/ is the orchestration layer - can import from features
  {
    files: ["lib/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // app/ pages are the composition root - can import from anywhere
  {
    files: ["app/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  }
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Feature boundary enforcement
  featureBoundaryRules,
  ...featureOverrides,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
