# Composable Manifest: features/auth

> **Generated**: 2026-01-31
> **Auditor**: Senior Systems Architect
> **Scope**: `/features/auth/` folder (with architecture reference)

---

## Executive Summary

| Category | Status | Notes |
|----------|--------|-------|
| Variable & Entity Registry | **PASS** | 7 schemas, 7 types, clean exports |
| Naming Audit | **PASS** | camelCase domain, snake_case DB |
| Type Safety | **PASS** | No `any`/`unknown` detected |
| Dependency Manifest | **PASS** | 0 feature bleed violations |
| Transformer Usage | **N/A** | Schemas only - no DB interaction |
| Integer Cents | **N/A** | No financial logic |
| Sync Integrity | **N/A** | Supabase Auth handles versioning |
| Soft Deletes | **N/A** | No DELETE operations |
| Auth Abstraction | **PASS** | Full IOC architecture in lib/auth/ |
| Performance | **PASS** | No watch() calls, static schemas |

**Overall Result: ALL MANDATES COMPLIANT**

---

## 1. Variable & Entity Registry

### 1.1 Feature File Inventory

**Location:** `/features/auth/` — **2 files, 85 lines total**

```
features/auth/
└── schemas/
    ├── auth.schema.ts      (68 lines)
    └── profile.schema.ts   (17 lines)
```

| File | Lines | Exports | Purpose |
|------|-------|---------|---------|
| [schemas/auth.schema.ts](features/auth/schemas/auth.schema.ts) | 68 | 4 schemas, 4 types | Authentication form validation |
| [schemas/profile.schema.ts](features/auth/schemas/profile.schema.ts) | 17 | 3 re-exports | Backward compat wrapper (deprecated) |

**Note:** `api/auth.ts` was **relocated** to `lib/auth/auth-api.ts` as part of IOC refactoring.

### 1.2 Entity Inventory (Detailed)

#### auth.schema.ts Exports

| Export | Kind | Line | Purpose |
|--------|------|------|---------|
| `signUpSchema` | Zod Schema | 5 | Sign-up form: firstName, lastName, email, password, confirmPassword |
| `loginSchema` | Zod Schema | 31 | Login form: email, password |
| `resetPasswordSchema` | Zod Schema | 40 | Password reset: email |
| `updatePasswordSchema` | Zod Schema | 48 | Update password: password, confirmPassword |
| `SignUpFormData` | Type | 65 | `z.infer<typeof signUpSchema>` |
| `LoginFormData` | Type | 66 | `z.infer<typeof loginSchema>` |
| `ResetPasswordFormData` | Type | 67 | `z.infer<typeof resetPasswordSchema>` |
| `UpdatePasswordFormData` | Type | 68 | `z.infer<typeof updatePasswordSchema>` |

#### profile.schema.ts Re-exports (from @/lib/schemas/profile.schema)

| Export | Kind | Source Line | Purpose |
|--------|------|-------------|---------|
| `updateProfileSchema` | Zod Schema | lib:16 | Profile update: firstName, lastName |
| `changePasswordSchema` | Zod Schema | lib:24 | Password change: currentPassword, newPassword, confirmPassword |
| `changeEmailSchema` | Zod Schema | lib:44 | Email change: newEmail, currentPassword |
| `UpdateProfileFormData` | Type | lib:50 | Inferred type |
| `ChangePasswordFormData` | Type | lib:51 | Inferred type |
| `ChangeEmailFormData` | Type | lib:52 | Inferred type |

### 1.3 Zod Schema Field Inventory

#### signUpSchema (Lines 5-28)

| Field | Type | Validators | Constants Used |
|-------|------|------------|----------------|
| `firstName` | string | `min()` | `VALIDATION.MIN_LENGTH.REQUIRED` |
| `lastName` | string | `min()` | `VALIDATION.MIN_LENGTH.REQUIRED` |
| `email` | string | `min()` | `VALIDATION.MIN_LENGTH.REQUIRED` |
| `password` | string | `min()`, `regex()` | `VALIDATION.PASSWORD.MIN_LENGTH`, regex pattern |
| `confirmPassword` | string | `min()` | `VALIDATION.MIN_LENGTH.REQUIRED` |
| *(refine)* | - | `password === confirmPassword` | `VALIDATION.MESSAGES.PASSWORDS_DONT_MATCH` |

**Password Regex Pattern (Lines 19-21):**
```typescript
/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
// Requires: lowercase + uppercase + digit
```

#### loginSchema (Lines 31-37)

| Field | Type | Validators | Constants Used |
|-------|------|------------|----------------|
| `email` | string | `min()`, `email()` | `VALIDATION.MIN_LENGTH.REQUIRED`, `VALIDATION.MESSAGES.INVALID_EMAIL` |
| `password` | string | `min()` | `VALIDATION.MIN_LENGTH.REQUIRED` |

#### resetPasswordSchema (Lines 40-45)

| Field | Type | Validators | Constants Used |
|-------|------|------------|----------------|
| `email` | string | `min()`, `email()` | `VALIDATION.MIN_LENGTH.REQUIRED`, `VALIDATION.MESSAGES.INVALID_EMAIL` |

#### updatePasswordSchema (Lines 48-62)

| Field | Type | Validators | Constants Used |
|-------|------|------------|----------------|
| `password` | string | `min()`, `regex()` | `VALIDATION.PASSWORD.MIN_LENGTH`, regex pattern |
| `confirmPassword` | string | `min()` | `VALIDATION.MIN_LENGTH.REQUIRED` |
| *(refine)* | - | `password === confirmPassword` | `VALIDATION.MESSAGES.PASSWORDS_DONT_MATCH` |

#### updateProfileSchema (lib/schemas/profile.schema.ts:16-19)

| Field | Type | Validators | Constants Used |
|-------|------|------------|----------------|
| `firstName` | string | `min()` | `VALIDATION.MIN_LENGTH.REQUIRED` |
| `lastName` | string | `min()` | `VALIDATION.MIN_LENGTH.REQUIRED` |

#### changePasswordSchema (lib/schemas/profile.schema.ts:24-39)

| Field | Type | Validators | Constants Used |
|-------|------|------------|----------------|
| `currentPassword` | string | `min()` | `VALIDATION.MIN_LENGTH.REQUIRED` |
| `newPassword` | string | `min()`, `regex()` | `VALIDATION.PASSWORD.MIN_LENGTH`, `VALIDATION.REGEX.PASSWORD` |
| `confirmPassword` | string | `min()` | `VALIDATION.MIN_LENGTH.REQUIRED` |
| *(refine)* | - | `newPassword === confirmPassword` | `VALIDATION.MESSAGES.PASSWORDS_DONT_MATCH` |

#### changeEmailSchema (lib/schemas/profile.schema.ts:44-47)

| Field | Type | Validators | Constants Used |
|-------|------|------------|----------------|
| `newEmail` | string | `email()` | `VALIDATION.MESSAGES.INVALID_EMAIL` |
| `currentPassword` | string | `min()` | `VALIDATION.MIN_LENGTH.REQUIRED` |

### 1.4 Naming Audit

| Convention | Expected | Actual | Status |
|------------|----------|--------|--------|
| Schema names | camelCase | `signUpSchema`, `loginSchema`, `changePasswordSchema` | **PASS** |
| Type names | PascalCase | `SignUpFormData`, `LoginFormData`, `ChangePasswordFormData` | **PASS** |
| Field names | camelCase | `firstName`, `lastName`, `newPassword`, `currentPassword` | **PASS** |
| Constants | SCREAMING_SNAKE | `VALIDATION.MIN_LENGTH.REQUIRED` | **PASS** |

### 1.5 Type Safety Audit

| Check | Result | Details |
|-------|--------|---------|
| `any` types | **NONE** | Grep returned 0 matches |
| `unknown` types | **NONE** | Grep returned 0 matches |
| Type assertions (`as`) | **NONE** | No `as any` or `as unknown` |
| Zod bypass | **NONE** | All types use `z.infer<>` |

**All 7 Zod schemas use `z.infer<typeof schema>` ensuring runtime validation matches compile-time types.**

---

## 2. Dependency Manifest

### 2.1 Complete Import Graph

#### auth.schema.ts Imports

| Line | Import | Source | Category |
|------|--------|--------|----------|
| 1 | `z` | `zod` | External package |
| 2 | `VALIDATION` | `@/lib/constants` | Lib folder |

#### profile.schema.ts Imports

| Line | Import | Source | Category |
|------|--------|--------|----------|
| 10-17 | Re-exports | `@/lib/schemas/profile.schema` | Lib folder |

### 2.2 Feature Bleed Check

**Result: PASS — 0 violations**

| Import Source | Category | Status |
|---------------|----------|--------|
| `zod` | External package | **ALLOWED** |
| `@/lib/constants` | Lib folder | **ALLOWED** |
| `@/lib/schemas/profile.schema` | Lib folder | **ALLOWED** |

**No imports from:**
- Other `features/*` folders ✓
- `@/components/*` (except shared) ✓
- Direct database clients ✓

### 2.3 Transformer Usage

**Result: NOT APPLICABLE**

The feature folder contains **only validation schemas**. No database interaction occurs here.

Data transformers are used in `lib/auth/supabase-*.ts` implementations (outside feature scope):
- `dbAuthUserToDomain()` — [data-transformers.ts:974](lib/data/data-transformers.ts#L974)
- `dbAuthSessionToDomain()` — [data-transformers.ts:991](lib/data/data-transformers.ts#L991)
- `dbAuthEventToDomain()` — [data-transformers.ts:1003](lib/data/data-transformers.ts#L1003)
- `domainMetadataToSupabase()` — [data-transformers.ts:1018](lib/data/data-transformers.ts#L1018)

---

## 3. Sacred Mandate Compliance

### 3.1 Integer Cents

**Status: N/A**

No financial logic in auth module. Schemas validate user credentials and profile data only.

### 3.2 Sync Integrity

**Status: N/A**

Auth operations use Supabase Auth service which handles its own versioning internally. User credentials are **not** synced via WatermelonDB Delta Sync.

### 3.3 Soft Deletes

**Status: N/A**

Feature folder contains schemas only. No DELETE operations exist. Account deletion (if implemented) would be in `lib/auth/` layer.

### 3.4 Auth Abstraction (IAuthProvider)

**Status: PASS**

The auth architecture implements full IOC abstraction:

```
┌─────────────────────────────────────────────────────────────────┐
│                    features/auth/schemas/                        │
│              (Zod validation schemas only)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        lib/auth/auth-api.ts                      │
│                      (IOC Factory + Singleton)                   │
│  initAuthApi(authProvider, credentialProvider, oauthProvider)   │
└──────────────┬───────────────────────────────────┬──────────────┘
               │                                   │
    ┌──────────▼──────────┐             ┌──────────▼──────────┐
    │   IAuthProvider     │             │  ICredentialAuth    │
    │   (199 lines)       │             │   Provider          │
    │                     │             │   (212 lines)       │
    │  - getCurrentUserId │             │                     │
    │  - isAuthenticated  │             │  - signUp           │
    │  - signOut          │             │  - signIn           │
    │  - getUser          │             │  - resetPassword    │
    │  - getSession       │             │  - updatePassword   │
    │  - updateMetadata   │             │  - changePassword   │
    │  - onAuthStateChange│             │  - changeEmail      │
    └──────────┬──────────┘             └──────────┬──────────┘
               │                                   │
    ┌──────────▼──────────────────────────────────▼──────────┐
    │     SupabaseAuthProvider + SupabaseCredentialProvider   │
    │               (lib/auth/supabase-*.ts)                  │
    │        Uses data transformers for type conversion       │
    └─────────────────────────────────────────────────────────┘
```

**Platform Configuration:**

| Platform | IAuthProvider | ICredentialAuthProvider | IOAuthAuthProvider |
|----------|---------------|------------------------|-------------------|
| Web | SupabaseAuthProvider | SupabaseCredentialProvider | `null` |
| iOS (future) | SupabaseAuthProvider | `null` | AppleAuthProvider |

**No direct Supabase calls in feature folder** — all encapsulated in `lib/auth/` implementations.

---

## 4. Performance & Scalability

### 4.1 React Compiler Check

**Status: PASS**

| Check | Result |
|-------|--------|
| `watch()` calls | **0** — Not found in feature folder |
| `useWatch` usage | **N/A** — No React hooks in schema files |

**Note:** Feature folder contains only Zod schemas (static validation). React-specific code exists in:
- `providers/auth-provider.tsx` — IOC composition root
- `stores/auth-store.ts` — Zustand state management

### 4.2 Re-render Optimization

**Status: PASS**

Schema files are **static** — no runtime hooks or effects. Optimization patterns exist in related files:

| Pattern | Location | Implementation |
|---------|----------|----------------|
| Singleton | [auth-api.ts:200](lib/auth/auth-api.ts#L200) | `_authApiInstance` module variable |
| Event deduplication | [supabase-auth-provider.ts:57](lib/auth/supabase-auth-provider.ts#L57) | `lastEventHash` for redundant event filtering |
| Ref guard | [auth-provider.tsx:31](providers/auth-provider.tsx#L31) | `initializedRef` prevents double-init in Strict Mode |

---

## 5. Architecture Reference (Related Files)

### 5.1 Auth Infrastructure (lib/auth/)

**Total: 10 files, 1,616 lines**

| File | Lines | Purpose |
|------|-------|---------|
| [auth-provider.interface.ts](lib/auth/auth-provider.interface.ts) | 199 | `IAuthProvider` interface + `AuthenticationError` class |
| [credential-auth-provider.interface.ts](lib/auth/credential-auth-provider.interface.ts) | 212 | `ICredentialAuthProvider` interface + input data types |
| [oauth-auth-provider.interface.ts](lib/auth/oauth-auth-provider.interface.ts) | 131 | `IOAuthAuthProvider` interface + `OAuthProvider` type |
| [supabase-auth-provider.ts](lib/auth/supabase-auth-provider.ts) | 250 | `SupabaseAuthProvider` implementation |
| [supabase-credential-provider.ts](lib/auth/supabase-credential-provider.ts) | 358 | `SupabaseCredentialProvider` implementation |
| [auth-api.ts](lib/auth/auth-api.ts) | 242 | `AuthApi` interface + IOC factory + singleton |
| [server-auth.ts](lib/auth/server-auth.ts) | 87 | Server-side auth utilities |
| [client.ts](lib/auth/client.ts) | 58 | Client export barrel |
| [server.ts](lib/auth/server.ts) | 24 | Server export barrel |
| [index.ts](lib/auth/index.ts) | 55 | Type-only export barrel |

### 5.2 Provider Interface Methods

#### IAuthProvider (Lines 43-186)

| Method | Signature | Notes |
|--------|-----------|-------|
| `getCurrentUserId()` | `Promise<string>` | Throws if not authenticated |
| `isAuthenticated()` | `Promise<boolean>` | Returns boolean |
| `signOut()` | `Promise<void>` | Optional method |
| `getUser()` | `Promise<AuthUserEntity \| null>` | Graceful null (no throw) |
| `getSession()` | `Promise<AuthSessionEntity \| null>` | Graceful null |
| `updateUserMetadata()` | `(metadata) => Promise<void>` | Atomic merge |
| `onAuthStateChange()` | `(callback) => AuthUnsubscribe` | Event stream filter |

#### ICredentialAuthProvider (Lines 113-211)

| Method | Signature | Notes |
|--------|-----------|-------|
| `signUp()` | `(data) => Promise<DataResult<SignUpResult, CredentialAuthError>>` | Returns DataResult |
| `signIn()` | `(data) => Promise<DataResult<SignInResult, CredentialAuthError>>` | Returns DataResult |
| `resetPassword()` | `(data) => Promise<DataResult<void, CredentialAuthError>>` | Always succeeds (security) |
| `updatePassword()` | `(data) => Promise<DataResult<void, CredentialAuthError>>` | After reset link |
| `changePassword()` | `(data) => Promise<DataResult<void, CredentialAuthError>>` | Requires reauth |
| `changeEmail()` | `(data) => Promise<DataResult<void, CredentialAuthError>>` | Requires reauth |

### 5.3 Domain Types (domain/auth.ts)

| Export | Type | Line | Purpose |
|--------|------|------|---------|
| `AuthUserEntity` | Interface | 38 | Platform-agnostic user profile |
| `AuthSessionEntity` | Interface | 74 | Session with tokens |
| `AuthEventType` | Type | 97 | `'SIGNED_IN' \| 'SIGNED_OUT' \| ...` |
| `AuthStateChangeCallback` | Type | 108 | Callback signature |
| `AuthUnsubscribe` | Type | 118 | Unsubscribe function |
| `AuthMethod` | Type | 174 | `'credential' \| 'oauth_apple' \| 'oauth_google'` |
| `SignInResult` | Interface | 195 | Sign-in success payload |
| `SignUpResult` | Interface | 220 | Sign-up success payload |
| `CredentialErrorCode` | Type | 254 | 8 error codes |
| `CredentialAuthError` | Interface | 278 | Error with code |
| `OAuthErrorCode` | Type | 302 | 5 error codes |
| `OAuthAuthError` | Interface | 323 | OAuth error |
| `OAuthSignInData` | Interface | 346 | OAuth input data |
| `hasEmail()` | Type guard | 127 | Checks `email !== null` |
| `hasFullName()` | Type guard | 134 | Checks both names present |
| `getDisplayName()` | Utility | 145 | Returns display name |

### 5.4 Data Transformers (lib/data/data-transformers.ts)

| Transformer | Line | Input | Output |
|-------------|------|-------|--------|
| `dbAuthUserToDomain()` | 974 | `SupabaseUser` | `AuthUserEntity` |
| `dbAuthSessionToDomain()` | 991 | `SupabaseSession` | `AuthSessionEntity` |
| `dbAuthEventToDomain()` | 1003 | `string` | `AuthEventType` |
| `domainMetadataToSupabase()` | 1018 | `Partial<metadata>` | `Record<string, unknown>` |

**Critical Field Handling:**
```typescript
// dbAuthUserToDomain (Line 976-978)
if (!supabaseUser.id) {
  throw new Error('AuthUserEntity: id cannot be null - data integrity failure');
}
```

### 5.5 Consumers

#### stores/auth-store.ts

| Aspect | Implementation |
|--------|----------------|
| State type | `AuthUserEntity \| null` (domain type) |
| API import | `getAuthApi, isAuthApiInitialized` from `@/lib/auth/client` |
| Guard pattern | `if (!isAuthApiInitialized()) return;` |

#### providers/auth-provider.tsx

| Aspect | Implementation |
|--------|----------------|
| IOC injection | `initAuthApi(authProvider, credentialProvider, oauthProvider)` |
| Provider creation | `createSupabaseAuthProvider(supabase)` |
| Ref guard | `initializedRef.current` prevents double-init |

---

## 6. Error Handling Patterns

### 6.1 Credential Error Codes

| Code | Trigger | HTTP |
|------|---------|------|
| `INVALID_CREDENTIALS` | Email or password incorrect | 401 |
| `EMAIL_NOT_CONFIRMED` | User hasn't confirmed email | 403 |
| `EMAIL_ALREADY_EXISTS` | Email already registered | 409 |
| `WEAK_PASSWORD` | Password doesn't meet requirements | 400 |
| `RATE_LIMITED` | Too many attempts | 429 |
| `REAUTHENTICATION_FAILED` | Reauthentication failed | 401 |
| `NETWORK_ERROR` | Network connectivity issue | - |
| `UNKNOWN_ERROR` | Unexpected error | 500 |

### 6.2 DataResult Pattern

All `ICredentialAuthProvider` methods return `DataResult<T, CredentialAuthError>`:

```typescript
// Success
{ success: true, data: { user, session, isNewUser } }

// Failure
{ success: false, data: null, error: { code: 'INVALID_CREDENTIALS', message: '...' } }
```

**Benefits:**
- No try/catch needed in calling code
- Explicit error handling
- Platform-agnostic error codes
- Swift can mirror with `Result<T, Error>`

---

## 7. Comparison: Previous vs Current

| Aspect | v2 (2026-01-30) | v3 (2026-01-31) |
|--------|-----------------|-----------------|
| Feature files | 3 files (472 lines) | 2 files (85 lines) |
| `api/auth.ts` | In feature folder | **Moved to lib/auth/** |
| Auth abstraction | FAIL | **PASS** |
| Direct Supabase calls | 12 in feature | 0 in feature |
| Profile schemas | In feature | Re-export from lib |
| IOC factory | Not implemented | Full implementation |
| DataResult pattern | Not used | All credential operations |
| Provider interfaces | 1 (IAuthProvider) | 3 (+ Credential, OAuth) |

---

## 8. Conclusion

**ALL SACRED MANDATES COMPLIANT**

The `features/auth` folder is now a **lean validation layer** containing only Zod schemas:

1. **Variable & Entity Registry**: 7 schemas, 7 types, all properly exported with `z.infer<>`
2. **Naming Audit**: Consistent camelCase for domain objects
3. **Type Safety**: Zero `any`/`unknown` types
4. **Dependency Manifest**: No feature bleed (only zod + lib imports)
5. **Auth Abstraction**: Full IOC architecture in `lib/auth/` with multi-provider support

**Architecture Benefits:**
- **Separation of concerns**: Validation (feature) vs Implementation (lib)
- **Platform-agnostic**: iOS can use same domain types with native providers
- **Testable**: Providers can be mocked via IOC injection
- **Type-safe**: DataResult pattern eliminates implicit errors

**No remediation required.**

---

## Appendix A: Complete Schema Definitions

```typescript
// features/auth/schemas/auth.schema.ts

export const signUpSchema = z.object({
  firstName: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.FIRST_NAME_REQUIRED),
  lastName: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.LAST_NAME_REQUIRED),
  email: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.EMAIL_REQUIRED),
  password: z.string()
    .min(VALIDATION.PASSWORD.MIN_LENGTH, VALIDATION.MESSAGES.PASSWORD_MIN_LENGTH)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, VALIDATION.MESSAGES.PASSWORD_REQUIREMENTS),
  confirmPassword: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CONFIRM_PASSWORD),
}).refine((data) => data.password === data.confirmPassword, {
  message: VALIDATION.MESSAGES.PASSWORDS_DONT_MATCH,
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: z.string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.EMAIL_REQUIRED)
    .email(VALIDATION.MESSAGES.INVALID_EMAIL),
  password: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.PASSWORD_REQUIRED),
});

export const resetPasswordSchema = z.object({
  email: z.string()
    .min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.EMAIL_REQUIRED)
    .email(VALIDATION.MESSAGES.INVALID_EMAIL),
});

export const updatePasswordSchema = z.object({
  password: z.string()
    .min(VALIDATION.PASSWORD.MIN_LENGTH, VALIDATION.MESSAGES.PASSWORD_MIN_LENGTH)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, VALIDATION.MESSAGES.PASSWORD_REQUIREMENTS),
  confirmPassword: z.string().min(VALIDATION.MIN_LENGTH.REQUIRED, VALIDATION.MESSAGES.CONFIRM_PASSWORD),
}).refine((data) => data.password === data.confirmPassword, {
  message: VALIDATION.MESSAGES.PASSWORDS_DONT_MATCH,
  path: ['confirmPassword'],
});

export type SignUpFormData = z.infer<typeof signUpSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;
```

## Appendix B: IOC Initialization Flow

```typescript
// providers/auth-provider.tsx (Composition Root)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, initialize } = useAuthStore();

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const supabase = createClient();

    // 1. Create providers
    const authProvider = createSupabaseAuthProvider(supabase);
    const credentialProvider = createSupabaseCredentialProvider(supabase);
    const oauthProvider = null; // iOS only

    // 2. IOC injection
    if (!isAuthApiInitialized()) {
      initAuthApi(authProvider, credentialProvider, oauthProvider);
    }

    // 3. Initialize store (now safe - authApi ready)
    initialize();

    // 4. Subscribe to auth state changes
    const unsubscribe = authProvider.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => unsubscribe();
  }, [initialize, setUser]);

  return <>{children}</>;
}
```

## Appendix C: Usage Examples

```typescript
// Using authApi in components
import { getAuthApi } from '@/lib/auth/client';

// Get current user
const user = await getAuthApi().getUser();

// Sign in with credentials
const result = await getAuthApi().credential?.signIn({ email, password });
if (result?.success) {
  console.log('Signed in:', result.data.user);
} else {
  console.error('Error:', result?.error.code);
}

// Check available auth methods
const methods = getAuthApi().availableAuthMethods();
// ['credential'] on web, ['oauth_apple'] on iOS
```
