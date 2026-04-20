---
name: qijuzhu
version: 0.1.0
description: |
  自动记录每日 AI 活动（Claude Code / Codex / OpenClaw）的 token 统计与工作摘要，沉淀对话记忆。
  触发场景：生成日报、查看用量、记录想法、填写用户画像、起居注相关操作。
tags:
  - productivity
  - logging
  - memory
  - ai-activity
pluginApi: "1.0"
minGatewayVersion: "1.0"
---

# 起居注 (qijuzhu)

自动记录每日 AI 工具活动，沉淀人机对话记忆。

## 可用命令

### 初始化 / 健康检查
```bash
node scripts/setup.js
```
首次运行：自动探测工具路径、创建输出目录、生成 `index.md` 和 `profile.md` 模板。
再次运行：显示 health check。

### 生成今日日报
```bash
node scripts/aggregate.js
```
输出到 `~/ai-memory/daily/YYYY-MM-DD.md`。

### 生成指定日期日报
```bash
node scripts/aggregate.js 2026-04-19
```

### 写入记忆
```bash
node scripts/remember.js "今天意识到..."
echo "..." | node scripts/remember.js
```
将一段文字追加到当月记忆文件 `~/ai-memory/memory/YYYY-MM.md`。
AI 在对话结束时提炼关键洞察后调用此命令。

### 画像访谈（AI 执行）
当用户说"帮我完善画像"或"填写 profile"时，AI 依次询问以下问题，
收集完整回答后写入 `~/ai-memory/profile.md`：
1. 你的主要身份 / 角色是什么？
2. 当前最核心的 1~2 个项目是什么？
3. 在接受或拒绝一件事时，你最看重什么？
4. 对你来说，什么比钱更重要？
5. 你的日常工作节奏是怎样的？有什么固定习惯或忌讳？
6. 你希望 AI 主动帮你做哪些事？哪些事情你不希望 AI 替你决定？

## 配置文件

位置：`~/.qiju/config.json`（由 setup 自动生成，可手动修改）

```json
{
  "output_root": "~/ai-memory",
  "tools": {
    "claude_code": { "enabled": true,  "path": "~/.claude/projects" },
    "codex":       { "enabled": true,  "path": "~/.codex/sessions"  },
    "openclaw":    { "enabled": false, "path": "~/.openclaw/agents"  }
  },
  "summary": { "mode": "basic", "model": "haiku" },
  "cron":    { "enabled": false, "times": ["18:00"] }
}
```

`summary.mode` 可选 `basic`（免费）或 `full`（调用 LLM 生成摘要）。

## 输出目录结构

```
~/ai-memory/
├── index.md          # 所有 Agent 的入口
├── profile.md        # 用户长期画像
├── daily/
│   └── YYYY-MM-DD.md # 每日 AI 活动日报
└── memory/
    └── YYYY-MM.md    # 月度对话记忆
```

## 支持的工具及数据来源

| 工具 | 日志路径 | Token 字段 |
|---|---|---|
| Claude Code | `~/.claude/projects/*/[session].jsonl` | `message.usage.input_tokens` 等 |
| Codex | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | `payload.info.total_token_usage` |
| OpenClaw | `~/.openclaw/agents/*/sessions/[session].jsonl` | `message.usage.input/output/cost` |

## 使用场景示例

> 用户：帮我生成今天的 AI 活动日报
→ 执行 `node scripts/aggregate.js`

> 用户：我想看昨天用了多少 token
→ 执行 `node scripts/aggregate.js 2026-04-19`

> 用户：帮我记一下，今天...
→ 提炼关键内容后执行 `node scripts/remember.js "..."`

> 用户：起居注的配置在哪里
→ `~/.qiju/config.json`
