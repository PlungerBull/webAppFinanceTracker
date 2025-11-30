import { createClient } from '@/lib/supabase/client';

export type ValidationResult = {
    valid: boolean;
    error?: string;
};

export const validateCategoryHierarchy = async (
    categoryId: string | undefined, // undefined for new category
    newParentId: string | null
): Promise<ValidationResult> => {
    // 1. Self-Parenting Prevention
    if (categoryId && newParentId === categoryId) {
        return { valid: false, error: "A category cannot be its own parent" };
    }

    // 2. Parent Must Exist (and check depth)
    if (newParentId) {
        const supabase = createClient();
        const { data: parent, error } = await supabase
            .from('categories')
            .select('parent_id')
            .eq('id', newParentId)
            .single();

        if (error || !parent) {
            return { valid: false, error: "Parent category does not exist" };
        }

        // 3. Two-Level Hierarchy Enforcement
        if (parent.parent_id) {
            return { valid: false, error: "Cannot create subcategory under another subcategory. Maximum 2 levels allowed." };
        }
    }

    // 4. Promotion Prevention (Subcategory -> Parent)
    // Only applicable if updating an existing category
    if (categoryId && newParentId === null) {
        const supabase = createClient();

        // Check if it was a subcategory before? 
        // Actually, we just need to check if it has transactions.
        // If it has transactions, it CANNOT be a parent.
        // Wait, "Rule: Transactions can ONLY be assigned to subcategories".
        // So if it becomes a parent (parent_id = NULL), it CANNOT have transactions.

        const { count, error } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', categoryId);

        if (error) {
            return { valid: false, error: "Failed to validate transaction constraints" };
        }

        if (count && count > 0) {
            return { valid: false, error: "Cannot convert to parent category while it has transactions" };
        }
    }

    return { valid: true };
};

export const canDeleteParent = async (parentId: string): Promise<{ canDelete: boolean; childCount: number; error?: string }> => {
    const supabase = createClient();

    const { count, error } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', parentId);

    if (error) {
        return { canDelete: false, childCount: 0, error: "Failed to check subcategories" };
    }

    const childCount = count || 0;

    if (childCount > 0) {
        return {
            canDelete: false,
            childCount,
            error: "Cannot delete parent category with subcategories. Move or delete subcategories first."
        };
    }

    return { canDelete: true, childCount: 0 };
};

export const getTransactionCountForCategory = async (categoryId: string): Promise<number> => {
    const supabase = createClient();

    const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', categoryId);

    if (error) {
        console.error("Failed to get transaction count", error);
        return 0;
    }

    return count || 0;
};

export const ensureSubcategoryOnly = async (categoryId: string): Promise<ValidationResult> => {
    const supabase = createClient();

    const { data: category, error } = await supabase
        .from('categories')
        .select('parent_id')
        .eq('id', categoryId)
        .single();

    if (error || !category) {
        return { valid: false, error: "Category not found" };
    }

    if (category.parent_id === null) {
        return { valid: false, error: "Transactions can ONLY be assigned to subcategories" };
    }

    return { valid: true };
};
