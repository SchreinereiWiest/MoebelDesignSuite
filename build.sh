#!/usr/bin/env bash

set -Eeuo pipefail

readonly project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly registry="ghcr.io/schreinereiwiest/moebeldesignsuite"
readonly frontend_image="${registry}/frontend:latest"
readonly backend_image="${registry}/backend:latest"

cd "${project_root}"

docker buildx build \
  --load \
  --file frontend/Dockerfile \
  --tag "${frontend_image}" \
  ./frontend

docker buildx build \
  --load \
  --file backend/Dockerfile \
  --tag "${backend_image}" \
  ./backend

docker push "${backend_image}"
docker push "${frontend_image}"
