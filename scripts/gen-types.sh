#!/bin/bash
#
# Supabase Type Generation Script
#
# Generates TypeScript types from the linked Supabase project.
# Handles stderr redirection to prevent CLI noise in output.
#
# Usage:
#   ./scripts/gen-types.sh           # Generate types (overwrites types/supabase.ts)
#   ./scripts/gen-types.sh --check   # CI mode: verify types are up-to-date (exit 1 if stale)
#   npm run gen-types
#
# Prerequisites:
#   - Supabase CLI installed (npx supabase)
#   - Project linked (supabase link --project-ref <ref>)
#
# CI/CD Integration:
#   Add to GitHub Actions or pre-commit hook:
#     ./scripts/gen-types.sh --check || echo "Run ./scripts/gen-types.sh to update types"
#
# CTO Mandate: This script suppresses nullable RPC parameter warnings
# (tracked in TODO.md under Technical Debt).
# CTO Mandate: Manual edits to types/supabase.ts are forbidden. Always
# regenerate via this script after adding/modifying migrations.
#

set -e

# Configuration
OUTPUT_FILE="types/supabase.ts"
TEMP_FILE="types/supabase.tmp.ts"
CHECK_MODE=false

if [ "$1" = "--check" ]; then
    CHECK_MODE=true
fi

echo "Generating Supabase types..."

# Ensure types directory exists
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Generate types, redirecting stderr to /dev/null to suppress warnings
# about nullable RPC parameters (known issue, tracked in TODO.md)
npx supabase gen types typescript --linked > "$TEMP_FILE" 2>/dev/null

# Safeguard: strip any CLI noise that leaks to stdout (e.g., "Initialising login role...")
# Valid TypeScript files start with 'export' — remove any preceding non-TS lines
if head -1 "$TEMP_FILE" | grep -qv '^export'; then
    # Find the first line starting with 'export' and trim everything before it
    FIRST_EXPORT=$(grep -n '^export' "$TEMP_FILE" | head -1 | cut -d: -f1)
    if [ -n "$FIRST_EXPORT" ]; then
        tail -n +"$FIRST_EXPORT" "$TEMP_FILE" > "${TEMP_FILE}.clean"
        mv "${TEMP_FILE}.clean" "$TEMP_FILE"
    fi
fi

# Only proceed if generation succeeded and produced output
if [ ! -s "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
    echo "Error: Type generation failed or produced empty output"
    echo "Ensure Supabase project is linked: supabase link --project-ref <ref>"
    exit 1
fi

if [ "$CHECK_MODE" = true ]; then
    # CI mode: compare generated types with committed types
    if diff -q "$TEMP_FILE" "$OUTPUT_FILE" > /dev/null 2>&1; then
        rm -f "$TEMP_FILE"
        echo "Types are up-to-date."
        exit 0
    else
        rm -f "$TEMP_FILE"
        echo "Error: types/supabase.ts is out of date with the database schema."
        echo "Run './scripts/gen-types.sh' to regenerate, then commit the result."
        exit 1
    fi
else
    # Generate mode: overwrite the types file
    mv "$TEMP_FILE" "$OUTPUT_FILE"
    echo "Types generated successfully: $OUTPUT_FILE"
    wc -l "$OUTPUT_FILE" | awk '{print "Generated " $1 " lines"}'
fi
