# 起居注 (qijuzhu)

自动记录每日 AI 工具活动，沉淀人机对话记忆。

## 可用命令

### 初始化 / 健康检查
```bash
npm run setup
```
首次运行自动探测 Claude Code / Codex / OpenClaw 路径并写配置。
再次运行显示 health check。

### 生成今日日报
```bash
npm run aggregate
```
输出到 `~/ai-memory/daily/YYYY-MM-DD.md`（路径由配置决定）。

### 生成指定日期日报
```bash
npm run aggregate -- 2026-04-19
```

## 配置文件

位置：`~/.qiju/config.yaml`（由 setup 自动生成）

```yaml
output_root: ~/ai-memory      # 日报和记忆的输出目录
tools:
  claude_code:
    enabled: true
    path: ~/.claude/projects
  codex:
    enabled: true
    path: ~/.codex/sessions
  openclaw:
    enabled: false
    path: ~/.openclaw/agents
summary:
  mode: basic                 # basic（免费）| full（调 Haiku）
  model: haiku
cron:
  enabled: false
  times: ["18:00"]
```

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
→ 执行 `npm run aggregate`

> 用户：我想看昨天用了多少 token
→ 执行 `npm run aggregate -- $(date -v-1d +%Y-%m-%d)`

> 用户：起居注的配置在哪里
→ `~/.qiju/config.yaml`
