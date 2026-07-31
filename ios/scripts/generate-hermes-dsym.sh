#!/bin/sh
# Generate hermes.framework.dSYM for App Store / TestFlight symbol upload.
# Prebuilt Hermes does not ship a matching dSYM; dsymutil creates one from the
# binary that is actually embedded in the app so UUIDs match.
set -eu

case "${CONFIGURATION:-}" in
  *Debug*)
    echo "[hermes-dsym] Skipping for Debug"
    exit 0
    ;;
esac

if [ -z "${DWARF_DSYM_FOLDER_PATH:-}" ]; then
  echo "warning: [hermes-dsym] DWARF_DSYM_FOLDER_PATH is empty; skipping"
  exit 0
fi

mkdir -p "${DWARF_DSYM_FOLDER_PATH}"

HERMES_BIN=""
for candidate in \
  "${TARGET_BUILD_DIR}/${FRAMEWORKS_FOLDER_PATH}/hermes.framework/hermes" \
  "${PODS_ROOT}/hermes-engine/destroot/Library/Frameworks/universal/hermes.xcframework/ios-arm64/hermes.framework/hermes"
do
  if [ -f "$candidate" ]; then
    HERMES_BIN="$candidate"
    break
  fi
done

if [ -z "$HERMES_BIN" ]; then
  echo "warning: [hermes-dsym] hermes binary not found; skipping"
  exit 0
fi

OUTPUT="${DWARF_DSYM_FOLDER_PATH}/hermes.framework.dSYM"
echo "[hermes-dsym] Source: ${HERMES_BIN}"
echo "[hermes-dsym] Output: ${OUTPUT}"

rm -rf "${OUTPUT}"
dsymutil "${HERMES_BIN}" -o "${OUTPUT}"

if [ ! -d "${OUTPUT}" ]; then
  echo "error: [hermes-dsym] failed to create hermes.framework.dSYM" >&2
  exit 1
fi

dwarfdump -u "${OUTPUT}" || true
echo "[hermes-dsym] Done"
