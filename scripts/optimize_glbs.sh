#!/usr/bin/env bash
# Decimate + meshopt-compress room hero GLBs for web delivery.
#
#   simplify (per-file ratio toward TARGET_FACES) -> EXT_meshopt_compression
#
# The runtime loader uses useGLTF(url, false, true) => meshopt decode is enabled.
# Outputs replace the GLBs in public/assets/ (originals are regenerable via
# generate_room_asset.py).
set -uo pipefail

TARGET_FACES=40000
FLOOR_RATIO=0.08
SIMPLIFY_ERROR=0.008
ASSETS="public/assets"
SCRATCH="scripts/_opt"
GT="npx --yes @gltf-transform/cli"

mkdir -p "$SCRATCH"

# Face count per source GLB (trimesh can read the uncompressed originals).
python - > "$SCRATCH/faces.txt" <<'PY'
import trimesh, glob, os
for f in sorted(glob.glob("public/assets/room-*.glb")):
    m = trimesh.load(f)
    gs = list(m.geometry.values()) if isinstance(m, trimesh.Scene) else [m]
    print(os.path.basename(f), sum(len(g.faces) for g in gs))
PY

printf "%-38s %8s %10s %10s\n" "asset" "ratio" "before" "after"
total_before=0
total_after=0
while read -r name faces; do
  in="$ASSETS/$name"
  simp="$SCRATCH/${name%.glb}-simp.glb"
  out="$SCRATCH/$name"
  ratio=$(python -c "print(max($FLOOR_RATIO, min(1.0, $TARGET_FACES/$faces)))")

  $GT simplify "$in" "$simp" --ratio "$ratio" --error "$SIMPLIFY_ERROR" >/dev/null 2>&1 || { echo "simplify FAILED: $name"; continue; }
  $GT meshopt "$simp" "$out" >/dev/null 2>&1 || { echo "meshopt FAILED: $name"; continue; }

  before=$(stat -c%s "$in"); after=$(stat -c%s "$out")
  total_before=$((total_before + before)); total_after=$((total_after + after))
  printf "%-38s %8s %8dKB %8dKB\n" "$name" "$ratio" "$((before/1024))" "$((after/1024))"
done < "$SCRATCH/faces.txt"

printf "%-38s %8s %8dKB %8dKB\n" "TOTAL" "" "$((total_before/1024))" "$((total_after/1024))"
