#!/bin/zsh
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "请先从 https://nodejs.org/en/download 安装 Node.js 22.12 或更新版本。"
  read "?按回车关闭。"
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm ci || exit 1
fi
npm run build || exit 1
node scripts/serve.mjs --open
