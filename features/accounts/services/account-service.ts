/**
 * Account Service Implementation
 *
 * Business logic layer for account operations.
 *
 * Responsibilities:
 * - Auth context extraction (via IAuthProvider)
 * - Business validation
 * - Error translation (DataResult -> throw)
 * - Orchestration of repository calls
 *
 * @module account-service
 */

import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import type { IAccountRepository } from '../repository/account-repository.interface';
import type { IAccountService } from './account-service.interface';
import type {
  CreateAccountDTO,
  UpdateAccountDTO,
  CreateAccountGroupResult,
  AccountFilters,
  AccountViewEntity,
} from '../domain';
import {
  AccountValidationError,
  ACCOUNT_VALIDATION,
  ACCOUNT_ERRORS,
} from '../domain';

/**
 * Account Service
 *
 * Implements business logic for account operations.
 */
export class AccountService implements IAccountService {
  constructor(
    private readonly repository: IAccountRepository,
    private readonly authProvider: IAuthProvider
  ) {}

  /**
   * Get current user ID from auth provider.
   *
   * @returns User ID
   * @throws {AuthenticationError} If not authenticated
   */
  private async getCurrentUserId(): Promise<string> {
    return this.authProvider.getCurrentUserId();
  }

  /**
   * Validate account name.
   *
   * @param name - Account name to validate
   * @throws {AccountValidationError} If name is invalid
   */
  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new AccountValidationError(ACCOUNT_ERRORS.NAME_REQUIRED, 'name');
    }
    if (name.length < ACCOUNT_VALIDATION.NAME_MIN_LENGTH) {
      throw new AccountValidationError(ACCOUNT_ERRORS.NAME_TOO_SHORT, 'name');
    }
    if (name.length > ACCOUNT_VALIDATION.NAME_MAX_LENGTH) {
      throw new AccountValidationError(ACCOUNT_ERRORS.NAME_TOO_LONG, 'name');
    }
  }

  /**
   * Validate color format.
   *
   * @param color - Hex color code to validate
   * @throws {AccountValidationError} If color is invalid
   */
  private validateColor(color: string): void {
    if (!ACCOUNT_VALIDATION.COLOR_REGEX.test(color)) {
      throw new AccountValidationError(ACCOUNT_ERRORS.INVALID_COLOR, 'color');
    }
  }

  async getAll(filters?: AccountFilters): Promise<AccountViewEntity[]> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getAll(userId, filters);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async getById(id: string): Promise<AccountViewEntity> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getById(userId, id);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async getByGroupId(groupId: string): Promise<AccountViewEntity[]> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.getByGroupId(userId, groupId);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async create(data: CreateAccountDTO): Promise<CreateAccountGroupResult> {
    // Validate input
    this.validateName(data.name);
    this.validateColor(data.color);

    if (!data.currencies || data.currencies.length === 0) {
      throw new AccountValidationError(
        ACCOUNT_ERRORS.CURRENCIES_REQUIRED,
        'currencies'
      );
    }

    if (data.currencies.length > ACCOUNT_VALIDATION.MAX_CURRENCIES_PER_GROUP) {
      throw new AccountValidationError(
        ACCOUNT_ERRORS.TOO_MANY_CURRENCIES,
        'currencies'
      );
    }

    const userId = await this.getCurrentUserId();
    const result = await this.repository.createWithCurrencies(userId, data);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async update(id: string, data: UpdateAccountDTO): Promise<AccountViewEntity> {
    // Validate input if provided
    if (data.name !== undefined) {
      this.validateName(data.name);
    }
    if (data.color !== undefined) {
      this.validateColor(data.color);
    }

    const userId = await this.getCurrentUserId();
    const result = await this.repository.update(userId, id, data);

    if (!result.success) {
      throw result.error;
    }

    return result.data;
  }

  async delete(id: string, version: number): Promise<void> {
    const userId = await this.getCurrentUserId();
    const result = await this.repository.delete(userId, id, version);

    if (!result.success) {
      throw result.error;
    }
  }
}
