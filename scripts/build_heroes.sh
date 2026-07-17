#!/usr/bin/env bash
# Build real textured hero GLBs for every room:
#   clean FLUX concept image -> TRELLIS-2 (lab GPU) -> optimize (meshopt + WebP).
# Output: public/assets/room-NN-hero.glb  (inspect with view_glb.mjs before wiring).
set -uo pipefail

ROOMS="${*:-01 02 03 04 05 06 07 08 09 10 11 12}"
GT="npx --yes @gltf-transform/cli"

for n in $ROOMS; do
  concept="scripts/_concepts/room-${n}-concept.png"
  raw="scripts/_opt/room-${n}-raw.glb"
  out="public/assets/room-${n}-hero.glb"
  if [ ! -f "$concept" ]; then echo "room $n: no concept ($concept), skip"; continue; fi
  echo "=== room $n ==="
  if bash scripts/generate_3d.sh "$concept" "$raw" 512 2>&1 | tail -1; then
    $GT optimize "$raw" "$out" --compress meshopt --texture-compress webp --simplify true --simplify-error 0.006 2>&1 | grep -E 'info:' || echo "  ! optimize failed for $n"
    rm -f "$raw"
    [ -f "$out" ] && echo "  -> $out ($(( $(stat -c%s "$out")/1024 )) KB)"
  else
    echo "  ! generation failed for $n"
  fi
done
echo "done."
