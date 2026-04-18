#!/usr/bin/env bash
# scripts/_paths.sh — shared path resolution for JARVIS shell scripts.
# Source this from any script under scripts/ or at repo root. Exports:
#   JARVIS_REPO_ROOT   absolute path to the repo checkout
#   JARVIS_BUILD_DIR   default build directory (JarvisTelemetry/.build/release)
#   JARVIS_APP_BUNDLE  absolute path to the JarvisWallpaper.app bundle
#
# Override precedence (highest first):
#   1. Already-exported env var
#   2. This file's auto-detection

# Resolve this file's directory regardless of how it is sourced.
# shellcheck disable=SC2128
__JARVIS_PATHS_SELF="${BASH_SOURCE[0]:-$0}"
__JARVIS_PATHS_DIR="$(cd "$(dirname "${__JARVIS_PATHS_SELF}")" && pwd)"

# scripts/_paths.sh lives one level below repo root.
: "${JARVIS_REPO_ROOT:=$(cd "${__JARVIS_PATHS_DIR}/.." && pwd)}"
: "${JARVIS_BUILD_DIR:=${JARVIS_REPO_ROOT}/JarvisTelemetry/.build/release}"
: "${JARVIS_APP_BUNDLE:=${JARVIS_REPO_ROOT}/JarvisWallpaper.app}"

export JARVIS_REPO_ROOT JARVIS_BUILD_DIR JARVIS_APP_BUNDLE
