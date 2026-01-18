#!/bin/bash
#
# Supabase Type Generation Script
#
# Generates TypeScript types from the linked Supabase project.
# Handles stderr redirection to prevent CLI noise in output.
#
# Usage:
#   ./scripts/gen-types.sh
#   npm run gen-types
#
# Prerequisites:
#   - Supabase CLI installed (npx supabase)
#   - Project linked (supabase link --project-ref <ref>)
#
# CTO Mandate: This script suppresses nullable RPC parameter warnings
# (tracked in TODO.md under Technical Debt).
#

set -e

# Configuration
OUTPUT_FILE="types/database.types.ts"
TEMP_FILE="types/database.types.tmp.ts"

echo "Generating Supabase types..."

# Ensure types directory exists
mkdir -p "$(dirname "$OUTPUT_FILE")"

# Generate types, redirecting stderr to /dev/null to suppress warnings
# about nullable RPC parameters (known issue, tracked in TODO.md)
npx supabase gen types typescript --linked > "$TEMP_FILE" 2>/dev/null

# Only replace if generation succeeded and produced output
if [ -s "$TEMP_FILE" ]; then
    mv "$TEMP_FILE" "$OUTPUT_FILE"
    echo "Types generated successfully: $OUTPUT_FILE"
    wc -l "$OUTPUT_FILE" | awk '{print "Generated " $1 " lines"}'
else
    rm -f "$TEMP_FILE"
    echo "Error: Type generation failed or produced empty output"
    echo "Ensure Supabase project is linked: supabase link --project-ref <ref>"
    exit 1
fi
