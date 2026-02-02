import { z } from 'zod';
import { ACCOUNT } from '@/lib/constants';

/**
 * Centralized error messages for grouping schemas.
 * Keeps UI components clean by defining all validation messages here.
 */
export const GROUPING_ERRORS = {
  NAME_REQUIRED: 'Grouping name is required',
  COLOR_INVALID: 'Color must be a valid hex code',
  SUBCATEGORY_NAME_REQUIRED: 'Subcategory name is required',
  PARENT_ID_REQUIRED: 'Parent grouping is required',
  PARENT_ID_INVALID: 'Invalid parent grouping ID',
} as const;

/**
 * Schema for creating a new grouping (parent category).
 * Used by AddGroupingForm component.
 */
export const groupingSchema = z.object({
  name: z.string().min(1, GROUPING_ERRORS.NAME_REQUIRED),
  color: z.string().regex(ACCOUNT.COLOR_REGEX, GROUPING_ERRORS.COLOR_INVALID),
});

export type GroupingFormData = z.infer<typeof groupingSchema>;

/**
 * Schema for creating a new subcategory.
 * Aligns with CreateSubcategoryDTO from domain.
 *
 * parentId uses UUID validation for referential integrity.
 */
export const subcategorySchema = z.object({
  name: z.string().min(1, GROUPING_ERRORS.SUBCATEGORY_NAME_REQUIRED),
  parentId: z.string().uuid(GROUPING_ERRORS.PARENT_ID_INVALID),
  color: z.string().regex(ACCOUNT.COLOR_REGEX, GROUPING_ERRORS.COLOR_INVALID).optional(),
});

export type SubcategoryFormData = z.infer<typeof subcategorySchema>;
