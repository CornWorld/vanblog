#!/bin/bash
set -e

CONTAINER_NAME="vanblog-dev"
IMAGE_NAME="vanblog:dev-test"
HOST_PORT=8080

echo "=== 1. Stop and remove old container ==="
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true
echo "done"

echo ""
echo "=== 2. Build dev image ==="
cd "$(dirname "$0")/.."
docker build --target dev -t "$IMAGE_NAME" \
  --build-arg "BUILD_VERSION=$(git describe --always --dirty --long 2>/dev/null || date -u +%Y%m%d%H%M%S)" . 2>&1 | tail -3

echo ""
echo "=== 3. Start fresh container ==="
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "$HOST_PORT:8080" \
  -e VANBLOG_HTTP_ONLY=1 \
  -e VANBLOG_EMAIL=test@example.com \
  "$IMAGE_NAME"

echo "waiting for services..."
sleep 15

echo ""
echo "=== 4. Create superuser ==="
docker exec "$CONTAINER_NAME" vanblog superuser upsert admin@test.com password123 --dir=/pb_data 2>&1 | tail -1

echo ""
echo "=== 5. Health check ==="
curl -sf "http://localhost:$HOST_PORT/api/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print('health:', d.get('message','FAIL'))"

echo ""
echo "=== 6. Verify hooks loaded ==="
docker logs "$CONTAINER_NAME" 2>&1 | grep "hook loaded"

echo ""
echo "=== Ready ==="
echo "Blog:      http://localhost:$HOST_PORT/"
echo "Setup:     http://localhost:$HOST_PORT/setup"
echo "Bookmarks: http://localhost:$HOST_PORT/p/bookmarks"
echo "PB Admin:  http://localhost:$HOST_PORT/_/"
echo ""
echo "Superuser: admin@test.com / password123"
echo ""
echo "Logs: docker logs -f $CONTAINER_NAME"
echo "Stop: docker stop $CONTAINER_NAME"
