#!/bin/bash
# 起居注 (qijuzhu) 安装脚本
# 用法：curl -fsSL https://raw.githubusercontent.com/ayaoplus/qijuzhu/main/install.sh | bash

set -e

REPO="https://github.com/ayaoplus/qijuzhu.git"
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

echo -e "${BOLD}起居注 (qijuzhu) 安装程序${NC}"
echo "================================"

# ── 环境检查 ──────────────────────────────────────────────────

if ! command -v node &>/dev/null; then
  echo -e "${RED}❌ 未找到 Node.js，请先安装 Node.js >= 18${NC}"
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(parseInt(process.version.slice(1)))")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo -e "${RED}❌ Node.js 版本过低（当前 $(node -v)），需要 >= 18${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

if ! command -v git &>/dev/null; then
  echo -e "${RED}❌ 未找到 git，请先安装 git${NC}"
  exit 1
fi

# ── 检测已安装的 Agent ────────────────────────────────────────

INSTALL_DIRS=()

if [ -d "$HOME/.claude" ]; then
  INSTALL_DIRS+=("$HOME/.claude/skills/qijuzhu")
  echo -e "${GREEN}✅ 检测到 Claude Code${NC}"
fi

if [ -d "$HOME/.codex" ]; then
  INSTALL_DIRS+=("$HOME/.codex/skills/qijuzhu")
  echo -e "${GREEN}✅ 检测到 Codex${NC}"
fi

if [ -d "$HOME/.openclaw" ]; then
  INSTALL_DIRS+=("$HOME/.openclaw/workspace/skills/qijuzhu")
  echo -e "${GREEN}✅ 检测到 OpenClaw${NC}"
fi

# 没检测到任何 Agent，装到默认位置
if [ ${#INSTALL_DIRS[@]} -eq 0 ]; then
  INSTALL_DIRS=("$HOME/.local/share/qijuzhu")
  echo -e "${YELLOW}⚠️  未检测到已知 Agent，安装到 ${INSTALL_DIRS[0]}${NC}"
fi

PRIMARY="${INSTALL_DIRS[0]}"

# ── 克隆或更新 ────────────────────────────────────────────────

echo ""
if [ -d "$PRIMARY/.git" ]; then
  echo "已有安装，更新中..."
  git -C "$PRIMARY" pull --ff-only
else
  echo "克隆仓库到 $PRIMARY ..."
  mkdir -p "$(dirname "$PRIMARY")"
  git clone --depth 1 "$REPO" "$PRIMARY"
fi
echo -e "${GREEN}✅ 代码就绪${NC}"

# ── 多 Agent 时创建符号链接 ──────────────────────────────────

for dir in "${INSTALL_DIRS[@]:1}"; do
  mkdir -p "$(dirname "$dir")"
  if [ -L "$dir" ]; then
    rm "$dir"
  fi
  ln -s "$PRIMARY" "$dir"
  echo -e "${GREEN}✅ 已链接: $dir${NC}"
done

# ── 初始化 ────────────────────────────────────────────────────

echo ""
node "$PRIMARY/scripts/setup.js"

# ── 完成提示 ──────────────────────────────────────────────────

echo ""
echo -e "${BOLD}🎉 安装完成！${NC}"
echo ""
echo "常用命令："
echo "  node $PRIMARY/scripts/aggregate.js          # 生成今日日报"
echo "  node $PRIMARY/scripts/aggregate.js 2026-04-19  # 指定日期"
echo "  node $PRIMARY/scripts/remember.js '...'     # 写入记忆"
echo ""
echo "配置文件：$HOME/.qiju/config.json"
echo "输出目录：$HOME/ai-memory/"
