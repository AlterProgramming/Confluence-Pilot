#!/usr/bin/env bash
# Generate a PBR-textured GLB from an image using trellis-2 on the lab GPU.
# Usage: bash scripts/generate_3d.sh <input_image> [output.glb] [resolution]
#
# Example:
#   bash scripts/generate_3d.sh public/room01.png public/room01.glb 512

set -euo pipefail

INPUT="${1:-}"
OUTPUT="${2:-model.glb}"
RESOLUTION="${3:-512}"

if [[ -z "$INPUT" ]]; then
  echo "Usage: $0 <input_image> [output.glb] [resolution]"
  exit 1
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Error: input file not found: $INPUT"
  exit 1
fi

# Load API key from .env.local if not already set
if [[ -z "${LAG_API_KEY:-}" ]]; then
  ENV_FILE="$(dirname "$0")/../.env.local"
  if [[ -f "$ENV_FILE" ]]; then
    LAG_API_KEY=$(grep -E '^LAG_API_KEY=' "$ENV_FILE" | cut -d= -f2-)
  fi
fi

if [[ -z "${LAG_API_KEY:-}" ]]; then
  echo "Error: LAG_API_KEY not set. Add it to .env.local or export it."
  exit 1
fi

BASE_URL="${LAG_BASE_URL:-https://gpu.aiccore-uno.ai/v1}"

echo "Generating 3D asset..."
echo "  Input:      $INPUT"
echo "  Output:     $OUTPUT"
echo "  Resolution: $RESOLUTION"
echo "  Endpoint:   $BASE_URL/3d/generations"

HTTP_STATUS=$(curl -s -X POST "$BASE_URL/3d/generations" \
  -H "Authorization: Bearer $LAG_API_KEY" \
  -F "image=@$INPUT" \
  -F "resolution=$RESOLUTION" \
  -o "$OUTPUT" \
  -w "%{http_code}")

if [[ "$HTTP_STATUS" == "200" ]]; then
  SIZE=$(wc -c < "$OUTPUT")
  echo "Done. Saved $OUTPUT (${SIZE} bytes)"
else
  echo "Error: HTTP $HTTP_STATUS"
  cat "$OUTPUT" 2>/dev/null || true
  exit 1
fi
