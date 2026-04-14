#!/bin/zsh

DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3456
URL="http://localhost:$PORT"

# Check if port is already in use
if lsof -ti tcp:$PORT &>/dev/null; then
  echo "⚡ Code Search 已在运行，直接打开浏览器..."
  open "$URL"
  exit 0
fi

# Install dependencies if node_modules missing
if [ ! -d "$DIR/node_modules" ]; then
  echo "📦 首次运行，安装依赖..."
  cd "$DIR" && npm install --silent
fi

echo "🚀 启动 Code Search..."
cd "$DIR" && node server.js &
SERVER_PID=$!

# Wait for server to be ready
for i in $(seq 1 20); do
  if curl -s "$URL" &>/dev/null; then
    break
  fi
  sleep 0.3
done

open "$URL"
echo "✅ 已在浏览器中打开: $URL"
echo "   按 Ctrl+C 停止服务"

# Keep running, kill server on exit
trap "kill $SERVER_PID 2>/dev/null; echo '\n🛑 服务已停止'" EXIT INT TERM
wait $SERVER_PID
