#!/bin/sh
# Builds the reference harness from the original C++ sources in the parent
# project (runtime/ and geometry/ do not depend on Qt).
#
# -ffp-contract=off keeps a*b+c as two rounded operations, matching JavaScript
# and the x86-64 desktop builds (arm64 clang would otherwise fuse them into FMA).
set -eu
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
root=$(CDPATH= cd -- "$here/../.." && pwd)
mkdir -p "$here/build"
${CXX:-c++} -std=c++20 -O1 -ffp-contract=off -I"$root" \
    "$here/harness.cpp" \
    "$root/runtime/GeometryRuntime.cpp" \
    "$root/runtime/RuntimeValue.cpp" \
    "$root/runtime/ApiMetadata.cpp" \
    "$root/runtime/ApiSemantics.cpp" \
    "$root/runtime/DebugAnchorResolver.cpp" \
    "$root/geometry/PreviewGeometryEngine.cpp" \
    "$root/geometry/ConnectorPreview.cpp" \
    -o "$here/build/harness"
echo "built $here/build/harness"
