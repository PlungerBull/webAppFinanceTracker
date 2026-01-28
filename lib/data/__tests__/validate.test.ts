import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateOrThrow,
  validateArrayOrThrow,
  SchemaValidationError,
} from '../validate';

const TestSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  count: z.number().int(),
});

describe('validateOrThrow', () => {
  it('returns parsed data on valid input', () => {
    const input = { id: '550e8400-e29b-41d4-a716-446655440000', name: 'test', count: 5 };
    const result = validateOrThrow(TestSchema, input, 'Test');
    expect(result).toEqual(input);
  });

  it('throws SchemaValidationError on invalid input', () => {
    const input = { id: 'not-a-uuid', name: 'test', count: 5 };
    expect(() => validateOrThrow(TestSchema, input, 'Test')).toThrow(SchemaValidationError);
  });

  it('includes schemaName in error', () => {
    try {
      validateOrThrow(TestSchema, {}, 'MySchema');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(SchemaValidationError);
      expect((e as SchemaValidationError).schemaName).toBe('MySchema');
    }
  });

  it('includes zodIssues and rawData in error', () => {
    const raw = { id: 123 };
    try {
      validateOrThrow(TestSchema, raw, 'Test');
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as SchemaValidationError;
      expect(err.issues.length).toBeGreaterThan(0);
      expect(err.rawData).toBe(raw);
    }
  });

  it('rejects float where int expected', () => {
    const input = { id: '550e8400-e29b-41d4-a716-446655440000', name: 'test', count: 5.5 };
    expect(() => validateOrThrow(TestSchema, input, 'Test')).toThrow(SchemaValidationError);
  });
});

describe('validateArrayOrThrow', () => {
  it('returns parsed array on valid input', () => {
    const items = [
      { id: '550e8400-e29b-41d4-a716-446655440000', name: 'a', count: 1 },
      { id: '550e8400-e29b-41d4-a716-446655440001', name: 'b', count: 2 },
    ];
    const result = validateArrayOrThrow(TestSchema, items, 'Test');
    expect(result).toEqual(items);
  });

  it('identifies failing index in error schemaName', () => {
    const items = [
      { id: '550e8400-e29b-41d4-a716-446655440000', name: 'a', count: 1 },
      { id: 'bad', name: 'b', count: 2 }, // index 1 fails
    ];
    try {
      validateArrayOrThrow(TestSchema, items, 'Test');
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as SchemaValidationError).schemaName).toBe('Test[1]');
    }
  });

  it('returns empty array for empty input', () => {
    expect(validateArrayOrThrow(TestSchema, [], 'Test')).toEqual([]);
  });
});
