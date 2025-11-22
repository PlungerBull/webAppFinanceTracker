/**
 * Category configuration and UI constants
 */

export const CATEGORY = {
  /**
   * Default category color
   */
  DEFAULT_COLOR: '#64748b', // Slate-500

  /**
   * API error messages and console logs
   */
  API: {
    ERRORS: {
      FETCH_ALL_FAILED: 'Failed to fetch categories',
      FETCH_ONE_FAILED: 'Failed to fetch category',
      CREATE_FAILED: 'Failed to create category',
      UPDATE_FAILED: 'Failed to update category',
      DELETE_FAILED: 'Failed to delete category',
      USER_NOT_AUTHENTICATED: 'User not authenticated',
    },
    CONSOLE: {
      FETCH_CATEGORIES: 'Error fetching categories:',
      FETCH_CATEGORY: 'Error fetching category:',
      CREATE_CATEGORY: 'Error creating category:',
      UPDATE_CATEGORY: 'Error updating category:',
      DELETE_CATEGORY: 'Error deleting category:',
      DELETE_CATEGORY_FAILED: 'Failed to delete category:',
    },
  },

  UI: {
    LABELS: {
      CATEGORIES: 'Categories',
      CREATE_CATEGORY: 'Create Category',
      EDIT_CATEGORY: 'Edit Category',
      DELETE_CATEGORY: 'Delete Category',
      ADD_CATEGORY: 'Add Category',
      CATEGORY_NAME: 'Category Name',
      CATEGORY_NAME_PLACEHOLDER: 'e.g., Groceries',
      COLOR: 'Color',
      CUSTOM_COLOR: 'Custom Color',
      ICON: 'Icon',
      SELECT_ICON: 'Select Icon',
      SEARCH_ICONS: 'Search icons...',
      NO_ICONS_FOUND: 'No icons found',
      SELECT_COLOR_ARIA: (color: string) => `Select color ${color}`,
      OPEN_MENU_ARIA: 'Open menu',
    },
    DESCRIPTIONS: {
      CREATE_CATEGORY: 'Create a new category to organize your transactions',
      EDIT_CATEGORY: 'Update category details',
    },
    MESSAGES: {
      CREATE_SUCCESS: 'Category created successfully',
      UPDATE_SUCCESS: 'Category updated successfully',
      DELETE_SUCCESS: 'Category deleted successfully',
      DELETE_CONFIRMATION: 'Are you sure you want to delete this category? This action cannot be undone.',
      DELETE_WARNING: 'This will also delete all transactions associated with this category.',
      TRANSACTION_COUNT_WARNING: (count: number) => `This category has ${count} associated transactions. Deleting it will remove the category from these transactions.`,
      LOADING: 'Loading...',
      NO_CATEGORIES: 'No categories yet!',
    },
    BUTTONS: {
      CREATE: 'Create Category',
      UPDATE: 'Update Category',
      DELETE: 'Delete Category',
      CANCEL: 'Cancel',
    },
  },
} as const;
