#!/usr/bin/env bash
set -e

CMD=${1:-help}

case "$CMD" in
  up)     docker compose up ;;
  up-d)   docker compose up -d ;;
  down)   docker compose down ;;
  status) docker compose ps ;;
  logs)   docker compose logs -f ;;
  clean)  docker compose down -v ;;
  *)
    echo "Usage: ./dev.sh [up|up-d|down|status|logs|clean]"
    ;;
esac
