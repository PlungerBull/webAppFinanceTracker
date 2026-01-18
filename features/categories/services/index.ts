/**
 * Category Services Exports
 *
 * @module category-services
 */

// Interface
export type { ICategoryService, MergeCategoriesResult } from './category-service.interface';

// Implementation
export {
  CategoryService,
  createCategoryService,
} from './category-service';
