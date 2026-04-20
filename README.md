# 起居注 (qijuzhu)

自动记录每日 AI 工具活动，沉淀人机对话记忆。兼容 Claude Code、Codex、OpenClaw。

## 功能

- **每日日报**：自动采集 Claude Code / Codex / OpenClaw 的 token 用量与工作内容
- **记忆沉淀**：将对话中的思考、决策写入月度记忆文件
- **共享底稿**：三个 AI 工具读同一份记忆目录，保持上下文一致

## 要求

- Node.js ≥ 18（无其他依赖）

## 安装

```bash
curl -fsSL https://raw.githubusercontent.com/ayaoplus/qijuzhu/main/install.sh | bash
```

自动完成：检测已安装的 Agent（Claude Code / Codex / OpenClaw）→ 克隆到对应 skill 目录 → 创建输出目录 → 生成配置文件。

已安装多个 Agent 时，自动建立符号链接共享同一份代码。

## 使用

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

追加到 `~/ai-memory/memory/YYYY-MM.md`，同一天多条记录自动合并在同一日期标题下。

### 健康检查

```bash
node scripts/setup.js   # 已初始化时自动切换为 health check 模式
```

## 输出目录结构

```
~/ai-memory/
├── index.md              # AI 入口文件，指向其他文件
├── profile.md            # 用户长期画像
├── daily/
│   └── YYYY-MM-DD.md     # 每日 AI 活动日报
└── memory/
    └── YYYY-MM.md        # 月度对话记忆
```

## 配置

配置文件位于 `~/.qiju/config.json`，由 setup 自动生成，可手动修改：

```json
{
  "output_root": "~/ai-memory",
  "tools": {
    "claude_code": { "enabled": true, "path": "~/.claude/projects" },
    "codex":       { "enabled": true, "path": "~/.codex/sessions" },
    "openclaw":    { "enabled": false, "path": "~/.openclaw/agents" }
  },
  "summary": {
    "mode": "basic",
    "model": "haiku"
  },
  "cron": {
    "enabled": false,
    "times": ["18:00"]
  }
}
```

`summary.mode` 可选 `basic`（免费，取首条用户消息）或 `full`（调用 LLM 生成摘要）。

## 日报示例

```markdown
# 2026-04-20 AI 活动日报

## Token 汇总
| 工具 | Sessions | Input | Output | Cache | Total | 费用 |
|---|---:|---:|---:|---:|---:|---:|
| Claude Code | 5 | 2,636,706 | 17,768 | 3,968,311 | 2,654,474 | - |
| Codex | 3 | 27,058 | 642 | 7,552 | 27,700 | - |
| OpenClaw | 2 | 13,505 | 312 | 0 | 13,817 | $0.07 |
| **合计** | **10** | **2,677,269** | **18,722** | **3,975,863** | **2,695,991** | - |

Cache 命中率（Claude Code）：38.6%

## Claude Code — 今日项目
- **qijuzhu**（3 sessions）：设计起居注 skill 架构...
```

## 在 Agent 中使用

在任意支持 skill 的 Agent 里，说：

- `帮我生成今天的日报` → Agent 执行 `node scripts/aggregate.js`
- `帮我记一下：...` → Agent 提炼内容后执行 `node scripts/remember.js "..."`
- `帮我完善用户画像` → Agent 依次提问，填写 `~/ai-memory/profile.md`
