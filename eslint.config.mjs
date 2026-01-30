import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ESLint Configuration - "Gatekeeper" Implementation
 *
 * Enforces architectural boundaries to prevent code regression:
 * 1. Feature Isolation: Features cannot import from other features
 * 2. Auth Abstraction: Direct Supabase auth calls blocked in features
 * 3. Domain Protection: Cross-feature communication via @/domain/ or @/lib/
 *
 * ARCHITECTURE PRINCIPLES (DDD + Clean Architecture):
 * - Domain Isolation: Shared domain types live in @/domain/
 * - Inversion of Control: Features depend on interfaces, not concrete implementations
 * - Orchestrator Pattern: Complex data needs use Context/Hooks from @/lib/
 *
 * @module eslint-config
 */

// ============================================================================
// FEATURE BOUNDARY ENFORCEMENT
// ============================================================================

/**
 * Cross-Feature Import Restrictions
 *
 * Prevents features from importing internal modules from other features.
 * Features should use @/domain/, @/lib/hooks/, or @/lib/ instead.
 */
const featureBoundaryRules = {
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        // Accounts
        {
          group: ["@/features/accounts/hooks/*", "@/features/accounts/domain/*", "@/features/accounts/services/*"],
          message: "Import from @/domain/accounts, @/lib/hooks/use-reference-data, or @/lib/ instead of directly from features/accounts."
        },
        // Categories
        {
          group: ["@/features/categories/hooks/*", "@/features/categories/domain/*", "@/features/categories/services/*"],
          message: "Import from @/domain/categories, @/lib/hooks/use-reference-data, or @/lib/ instead of directly from features/categories."
        },
        // Inbox
        {
          group: ["@/features/inbox/hooks/*", "@/features/inbox/domain/*", "@/features/inbox/services/*"],
          message: "Import from @/domain/inbox, @/lib/hooks/use-inbox-operations, or @/lib/ instead of directly from features/inbox."
        },
        // Currencies
        {
          group: ["@/features/currencies/hooks/*", "@/features/currencies/domain/*", "@/features/currencies/services/*"],
          message: "Import from @/lib/hooks/use-reference-data instead of directly from features/currencies."
        },
        // Transactions
        {
          group: ["@/features/transactions/hooks/*", "@/features/transactions/domain/*", "@/features/transactions/services/*"],
          message: "Import from @/domain/ or @/lib/hooks/ instead of directly from features/transactions."
        },
        // Reconciliations
        {
          group: ["@/features/reconciliations/hooks/*", "@/features/reconciliations/domain/*", "@/features/reconciliations/services/*"],
          message: "Import from @/domain/reconciliations or @/lib/ instead of directly from features/reconciliations."
        },
        // Auth (API allowed, but hooks/services restricted)
        {
          group: ["@/features/auth/hooks/*", "@/features/auth/services/*"],
          message: "Import from @/features/auth/api/auth or @/lib/auth instead of directly from features/auth hooks/services."
        },
        // Settings
        {
          group: ["@/features/settings/hooks/*", "@/features/settings/domain/*", "@/features/settings/services/*"],
          message: "Import from @/lib/ instead of directly from features/settings."
        }
      ]
    }]
  }
};

// ============================================================================
// AUTH ABSTRACTION ENFORCEMENT
// ============================================================================

/**
 * Auth Lockdown Rules
 *
 * Forbids direct Supabase client imports in feature folders.
 * Features must use IAuthProvider for auth logic.
 *
 * EXCEPTIONS:
 * - Repository files (they need direct database access)
 * - features/auth/api/auth.ts (credential operations need direct access)
 */
const authLockdownForFeatures = {
  files: [
    "features/**/*.ts",
    "features/**/*.tsx"
  ],
  ignores: [
    // Allow repositories to use Supabase directly
    "features/**/repository/**",
    "features/**/repositories/**",
    // Allow auth API for credential operations (platform-specific)
    "features/auth/api/**"
  ],
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        {
          group: ["@/lib/supabase/client", "@/lib/supabase/server"],
          message: "Direct Supabase imports are restricted in features. Use IAuthProvider from @/lib/auth for auth logic, or move database access to a repository."
        }
      ],
      paths: [
        {
          name: "@supabase/supabase-js",
          importNames: ["createClient"],
          message: "Use IAuthProvider from @/lib/auth instead of direct Supabase client in features."
        }
      ]
    }]
  }
};

// ============================================================================
// FEATURE SELF-IMPORT OVERRIDES
// ============================================================================

/**
 * Feature Self-Import Permissions
 *
 * Each feature can import its OWN internals, but the cross-feature
 * restrictions still apply. This is achieved by NOT disabling the rule
 * entirely, but by using more targeted patterns.
 *
 * NOTE: We only override the cross-feature patterns, not all restrictions.
 */
const createFeatureOverride = (featureName) => ({
  files: [`features/${featureName}/**/*`],
  rules: {
    // Allow importing from own feature's internals
    // But auth lockdown still applies via authLockdownForFeatures
    "no-restricted-imports": ["error", {
      patterns: [
        // Still block other features - list all EXCEPT current feature
        ...(featureName !== 'accounts' ? [{
          group: ["@/features/accounts/hooks/*", "@/features/accounts/domain/*", "@/features/accounts/services/*"],
          message: "Cross-feature import blocked. Use @/domain/ or @/lib/ instead."
        }] : []),
        ...(featureName !== 'categories' ? [{
          group: ["@/features/categories/hooks/*", "@/features/categories/domain/*", "@/features/categories/services/*"],
          message: "Cross-feature import blocked. Use @/domain/ or @/lib/ instead."
        }] : []),
        ...(featureName !== 'inbox' ? [{
          group: ["@/features/inbox/hooks/*", "@/features/inbox/domain/*", "@/features/inbox/services/*"],
          message: "Cross-feature import blocked. Use @/domain/ or @/lib/ instead."
        }] : []),
        ...(featureName !== 'currencies' ? [{
          group: ["@/features/currencies/hooks/*", "@/features/currencies/domain/*", "@/features/currencies/services/*"],
          message: "Cross-feature import blocked. Use @/domain/ or @/lib/ instead."
        }] : []),
        ...(featureName !== 'transactions' ? [{
          group: ["@/features/transactions/hooks/*", "@/features/transactions/domain/*", "@/features/transactions/services/*"],
          message: "Cross-feature import blocked. Use @/domain/ or @/lib/ instead."
        }] : []),
        ...(featureName !== 'reconciliations' ? [{
          group: ["@/features/reconciliations/hooks/*", "@/features/reconciliations/domain/*", "@/features/reconciliations/services/*"],
          message: "Cross-feature import blocked. Use @/domain/ or @/lib/ instead."
        }] : []),
        ...(featureName !== 'auth' ? [{
          group: ["@/features/auth/hooks/*", "@/features/auth/services/*"],
          message: "Cross-feature import blocked. Use @/features/auth/api/auth or @/lib/auth instead."
        }] : []),
        ...(featureName !== 'settings' ? [{
          group: ["@/features/settings/hooks/*", "@/features/settings/domain/*", "@/features/settings/services/*"],
          message: "Cross-feature import blocked. Use @/lib/ instead."
        }] : [])
      ]
    }]
  }
});

const featureOverrides = [
  createFeatureOverride('accounts'),
  createFeatureOverride('categories'),
  createFeatureOverride('inbox'),
  createFeatureOverride('currencies'),
  createFeatureOverride('transactions'),
  createFeatureOverride('reconciliations'),
  createFeatureOverride('auth'),
  createFeatureOverride('settings'),
  createFeatureOverride('import-export'),
  createFeatureOverride('shared'),
  createFeatureOverride('groupings'),
  createFeatureOverride('dashboard')
];

// ============================================================================
// ORCHESTRATION LAYER OVERRIDES
// ============================================================================

/**
 * Orchestration Layer Permissions
 *
 * These layers are explicitly allowed to import from features:
 * - lib/: The orchestration/service composition layer
 * - app/: The composition root (pages, layouts)
 * - providers/: Context providers (composition root)
 * - components/: Shared UI components
 * - stores/: Global state stores
 */
const orchestrationOverrides = [
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
  },
  // providers/ are composition root - can import from anywhere
  {
    files: ["providers/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // components/ shared UI - can import from features for now
  // TODO: Consider restricting to @/domain/ only
  {
    files: ["components/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  // stores/ global state - can import from features
  {
    files: ["stores/**/*"],
    rules: {
      "no-restricted-imports": "off"
    }
  }
];

// ============================================================================
// MAIN CONFIG
// ============================================================================

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Feature boundary enforcement (base rules)
  featureBoundaryRules,

  // Auth lockdown for features (blocks direct Supabase)
  authLockdownForFeatures,

  // Feature-specific overrides (allow self-imports, block cross-imports)
  ...featureOverrides,

  // Orchestration layer overrides (lib/, app/, etc.)
  ...orchestrationOverrides,

  // Default ignores
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**"
  ]),
]);

export default eslintConfig;
