/**
 * Zod Network Boundary Validation Helpers
 *
 * Use at every Supabase boundary BEFORE passing data to transformers.
 * Ensures malformed server data crashes at the edge, not deep inside React components.
 *
 * @module types/validate
 */

import { z } from 'zod';

/**
 * Thrown when server data fails Zod schema validation at the network boundary.
 * The `schemaName` identifies which table/RPC failed for error boundary logging.
 */
export class SchemaValidationError extends Error {
  constructor(
    public readonly schemaName: string,
    public readonly issues: z.ZodIssue[],
    public readonly rawData: unknown,
  ) {
    super(
      `[SchemaValidation] ${schemaName} failed: ${JSON.stringify(issues)}`,
    );
    this.name = 'SchemaValidationError';
  }
}

/**
 * Validate data against a Zod schema. Throws SchemaValidationError on failure.
 * Use at every network boundary BEFORE passing data to transformers.
 */
export function validateOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  schemaName: string,
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(
      `[SchemaValidation] ${schemaName}:`,
      result.error.issues,
      data,
    );
    throw new SchemaValidationError(schemaName, result.error.issues, data);
  }
  return result.data;
}

/**
 * Validate an array of records. Each element validated individually for precise error reporting.
 * If record #452 in a batch of 500 is malformed, the error identifies the exact index.
 */
export function validateArrayOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown[],
  schemaName: string,
): z.infer<T>[] {
  return data.map((item, i) =>
    validateOrThrow(schema, item, `${schemaName}[${i}]`),
  );
}
