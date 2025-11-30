/**
 * Grouping configuration and UI constants
 * Groupings are parent categories with specialized UI for managing category hierarchies
 */

export const GROUPING = {
  /**
   * Default grouping color (slate)
   */
  DEFAULT_COLOR: '#64748b',

  /**
   * API error messages and console logs
   */
  API: {
    ERRORS: {
      FETCH_ALL_FAILED: 'Failed to fetch groupings',
      FETCH_CHILDREN_FAILED: 'Failed to fetch subcategories',
      CREATE_FAILED: 'Failed to create grouping',
      UPDATE_FAILED: 'Failed to update grouping',
      DELETE_FAILED: 'Failed to delete grouping',
      USER_NOT_AUTHENTICATED: 'User not authenticated',
    },
    CONSOLE: {
      FETCH_GROUPINGS: 'Error fetching groupings:',
      FETCH_CHILDREN: 'Error fetching children:',
      CREATE_GROUPING: 'Error creating grouping:',
      UPDATE_GROUPING: 'Error updating grouping:',
      DELETE_GROUPING: 'Error deleting grouping:',
    },
  },

  /**
   * UI labels, messages, and button text
   */
  UI: {
    LABELS: {
      GROUPINGS: 'Groupings',
      GROUPING: 'Grouping',
      CREATE_GROUPING: 'Create Grouping',
      EDIT_GROUPING: 'Edit Grouping',
      DELETE_GROUPING: 'Delete Grouping',
      ADD_GROUPING: 'Add Grouping',
      GROUPING_NAME: 'Grouping Name',
      GROUPING_NAME_PLACEHOLDER: 'e.g., Transportation, Food & Dining',
      GROUPING_COLOR: 'Grouping Color',
      CREATE_SUBCATEGORY: 'Create Subcategory',
      SUBCATEGORY_NAME: 'Subcategory Name',
      SUBCATEGORY_NAME_PLACEHOLDER: 'e.g., Fuel, Groceries',
      SUBCATEGORIES: 'Subcategories',
      REASSIGN_PARENT: 'Reassign to Parent',
      SELECT_SUBCATEGORIES: 'Select Subcategories',
      SELECT_TARGET_PARENT: 'Select Target Parent',
      SUBCATEGORY_OF: 'Subcategory of',
      REASSIGN: 'Reassign',
    },
    DESCRIPTIONS: {
      CREATE_GROUPING: 'Create a new parent grouping for organizing subcategories.',
      EDIT_GROUPING: 'Update grouping details and manage subcategories.',
      CREATE_SUBCATEGORY: (parentName: string) => `Create a new subcategory for ${parentName}`,
      REASSIGN_SUBCATEGORIES: 'Select one or more subcategories to reassign to a different parent.',
    },
    MESSAGES: {
      DELETE_BLOCKED: "Can't delete until all subcategories have been reassigned",
      DELETE_CONFIRMATION: 'Are you sure you want to delete this grouping? This action cannot be undone.',
      DELETE_WARNING: 'This grouping has no subcategories and can be safely deleted.',
      NO_GROUPINGS: 'No groupings yet!',
      NO_SUBCATEGORIES: 'No subcategories yet',
      LOADING: 'Loading...',
      CREATE_SUCCESS: 'Grouping created successfully',
      UPDATE_SUCCESS: 'Grouping updated successfully',
      DELETE_SUCCESS: 'Grouping deleted successfully',
      SUBCATEGORY_CREATE_SUCCESS: 'Subcategory created successfully',
      SUBCATEGORY_REASSIGN_SUCCESS: 'Subcategory reassigned successfully',
      GROUPING_NAME_REQUIRED: 'Grouping name is required',
      SUBCATEGORY_NAME_REQUIRED: 'Subcategory name is required',
      SELECT_SUBCATEGORIES_WARNING: 'Please select at least one subcategory',
      SELECT_TARGET_PARENT_WARNING: 'Please select a target parent',
    },
    BUTTONS: {
      CREATE: 'Create Grouping',
      UPDATE: 'Update Grouping',
      DELETE: 'Delete Grouping',
      CANCEL: 'Cancel',
      CREATE_SUBCATEGORY: 'Create Subcategory',
      REASSIGN: 'Reassign',
    },
  },
} as const;
