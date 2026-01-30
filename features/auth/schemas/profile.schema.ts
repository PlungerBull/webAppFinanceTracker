/**
 * Profile Validation Schemas
 *
 * Re-exports from @/lib/schemas/profile.schema for backward compatibility.
 * New code should import directly from @/lib/schemas/profile.schema.
 *
 * @module auth/schemas/profile
 * @deprecated Import from @/lib/schemas/profile.schema instead
 */

export {
  updateProfileSchema,
  changePasswordSchema,
  changeEmailSchema,
  type UpdateProfileFormData,
  type ChangePasswordFormData,
  type ChangeEmailFormData,
} from '@/lib/schemas/profile.schema';