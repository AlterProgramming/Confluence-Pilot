#!/usr/bin/env bash
# Decimate + meshopt-compress all room hero + prop GLBs for web delivery,
# IN PLACE.
#
#   simplify (per-file ratio toward TARGET_FACES) -> EXT_meshopt_compression
#
# The runtime loader uses useGLTF(url, false, true) => meshopt decode is enabled.
# Originals are regenerable via generate_room_asset.py / generate_assets.py.
# Skips files that are already meshopt-compressed (trimesh can't read those).
set -uo pipefail

TARGET_FACES=40000
FLOOR_RATIO=0.08
SIMPLIFY_ERROR=0.008
SCRATCH="scripts/_opt"
GT="npx --yes @gltf-transform/cli"

mkdir -p "$SCRATCH"

# Collect every GLB under public/assets (heroes + props).
mapfile -t GLBS < <(find public/assets -name '*.glb' | sort)

printf "%-46s %8s %10s %10s\n" "asset" "ratio" "before" "after"
total_before=0; total_after=0; done=0; skipped=0
for in in "${GLBS[@]}"; do
  name=$(basename "$in")
  # Face count (trimesh); skip if unreadable (already compressed).
  faces=$(python - "$in" <<'PY' 2>/dev/null
import sys, trimesh
try:
    m = trimesh.load(sys.argv[1])
    gs = list(m.geometry.values()) if isinstance(m, trimesh.Scene) else [m]
    print(sum(len(g.faces) for g in gs))
except Exception:
    print(-1)
PY
)
  if [ "$faces" -le 0 ] 2>/dev/null; then
    printf "%-46s %8s %10s %10s\n" "$name" "-" "skip" "(compressed?)"; skipped=$((skipped+1)); continue
  fi

  ratio=$(python -c "print(max($FLOOR_RATIO, min(1.0, $TARGET_FACES/$faces)))")
  simp="$SCRATCH/${name%.glb}-simp.glb"
  tmp="$SCRATCH/$name"

  $GT simplify "$in" "$simp" --ratio "$ratio" --error "$SIMPLIFY_ERROR" >/dev/null 2>&1 || { echo "simplify FAILED: $name"; continue; }
  $GT meshopt "$simp" "$tmp" >/dev/null 2>&1 || { echo "meshopt FAILED: $name"; continue; }

  before=$(stat -c%s "$in"); after=$(stat -c%s "$tmp")
  cp "$tmp" "$in"   # replace in place
  total_before=$((total_before + before)); total_after=$((total_after + after)); done=$((done+1))
  printf "%-46s %8s %8dKB %8dKB\n" "$name" "$ratio" "$((before/1024))" "$((after/1024))"
done

printf "%-46s %8s %8dKB %8dKB\n" "TOTAL ($done optimized, $skipped skipped)" "" "$((total_before/1024))" "$((total_after/1024))"
