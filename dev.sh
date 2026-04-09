#!/bin/bash

# Pulse ID Development Script

set -e

case "$1" in
    "up")
        echo "🚀 Starting all services..."
        docker compose up --build
        ;;
    "up-d")
        echo "🚀 Starting all services in background..."
        docker compose up -d --build
        ;;
    "down")
        echo "🛑 Stopping all services..."
        docker compose down
        ;;
    "logs")
        service=${2:-""}
        if [ -n "$service" ]; then
            echo "📋 Showing logs for $service..."
            docker compose logs -f "$service"
        else
            echo "📋 Showing all logs..."
            docker compose logs -f
        fi
        ;;
    "restart")
        echo "🔄 Restarting all services..."
        docker compose restart
        ;;
    "clean")
        echo "🧹 Cleaning up containers and volumes..."
        docker compose down -v
        docker system prune -f
        ;;
    "status")
        echo "📊 Service status:"
        docker compose ps
        ;;
    *)
        echo "Usage: $0 {up|up-d|down|logs|restart|clean|status} [service]"
        echo ""
        echo "Commands:"
        echo "  up      - Start all services with build"
        echo "  up-d    - Start all services in background"
        echo "  down    - Stop all services"
        echo "  logs    - Show logs (optionally for specific service)"
        echo "  restart - Restart all services"
        echo "  clean   - Remove containers, volumes, and prune system"
        echo "  status  - Show service status"
        echo ""
        echo "Services: postgres, backend, frontend"
        exit 1
        ;;
esac