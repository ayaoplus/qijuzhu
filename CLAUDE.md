# 起居注 (qijuzhu) — 项目文档

> 现代版"起居注"：自动记录每日 AI 工具活动，沉淀人机对话记忆，长期积累后形成可查阅的个人 AI 使用史。

---

## 一、项目定位

通用 Claude Skill，面向所有重度使用多个 AI 工具的用户。核心价值：

1. **自动统计** Claude Code / Codex / OpenClaw 每日 token 用量与工作内容
2. **沉淀记忆** 将人机对话提炼成结构化的用户画像与月度笔记
3. **共享底稿** 多个 AI 工具读同一份记忆目录，形成统一上下文

取代 PulseFlow，不并行。

---

## 二、已定架构

### 数据目录（用户资产，默认 `~/ai-memory/`）

```
~/ai-memory/
├── index.md              # 所有 Agent 的入口，指向其他文件
├── profile.md            # 长期用户画像（随时间更新，不是流水账）
├── daily/
│   └── YYYY-MM-DD.md     # AI 活动日报（token 统计 + 工作摘要）
└── memory/
    ├── YYYY-MM.md        # 月度对话记忆（按日期分隔，不按日建文件）
    └── ...
```

### Skill 目录（工具代码）

```
qijuzhu/                  # 本仓库
├── CLAUDE.md             # 本文件
├── SKILL.md              # AI 读取的 skill 说明
├── config/
│   └── default.yaml      # 默认配置模板
├── scripts/
│   ├── setup.ts          # 首次初始化 + health-check
│   ├── ingest/
│   │   ├── claude-code.ts
│   │   ├── codex.ts
│   │   └── openclaw.ts
│   └── aggregate.ts      # 每日汇总入口
└── prompts/
    └── summarize.md      # full 模式摘要 prompt 模板
```

---

## 三、三工具数据字段

### Claude Code
- 路径：`~/.claude/projects/*/[session-id].jsonl`
- Token 字段：`message.usage.input_tokens` / `output_tokens` / `cache_creation_input_tokens` / `cache_read_input_tokens`
- 聚合：取每个 session **最后一条** usage（累计值）
- 项目名：从目录名解析

### Codex
- 路径：`~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`
- Token 字段：过滤 `type=="event_msg"` + `payload.type=="token_count"` + `payload.info!=null`，取 `payload.info.total_token_usage`（含 input/output/cached_input/reasoning_output）
- 聚合：取每个 session **最大** `total_token_usage`

### OpenClaw
- 路径：`~/.openclaw/agents/*/sessions/[session-id].jsonl`
- Token 字段：assistant 消息的 `usage.input` / `output` / `cacheRead` / `cacheWrite` / `totalTokens`
- **有 USD 费用**：`usage.cost.total`
- 聚合：每条消息**累加**（非累计值）
- Agent 名：从路径中的 agentId 取

---

## 四、每日日报模板

### Basic 模式（默认，零成本）
- Token 汇总表（三工具 + 合计）
- Claude Code 按项目列出 session 数 + 首条用户消息
- Codex session 标题列表
- OpenClaw agent + 首条用户消息

### Full 模式（可选，调 Haiku）
- 在 basic 基础上，为每个项目/session 生成 1~2 句摘要

---

## 五、配置项

```yaml
# ~/.qiju/config.yaml（setup 时自动生成）
output_root: ~/ai-memory/
tools:
  claude_code:
    path: ~/.claude/projects/
    enabled: true
  codex:
    path: ~/.codex/sessions/
    enabled: true
  openclaw:
    path: ~/.openclaw/agents/
    enabled: true
summary_model: haiku        # basic | haiku | sonnet
aggregation_frequency: 1    # 每天汇总次数（0=纯手动）
cron_enabled: false         # 是否启用内置 cron
```

setup 时自动探测各工具路径并写入配置；探测失败则提示用户手动填写。

---

## 六、第一阶段范围

1. `config/default.yaml` + `scripts/setup.ts`（路径探测 + health-check）
2. `scripts/ingest/claude-code.ts`（端到端跑通）
3. `scripts/ingest/codex.ts`
4. `scripts/ingest/openclaw.ts`
5. `scripts/aggregate.ts`（手动触发，输出 daily/YYYY-MM-DD.md）
6. `SKILL.md` + `index.md` 模板

记忆系统（profile.md + memory/）作为第二阶段。

---

## 七、开发约定

- 原子提交：**每完成一个可验证单元立即 commit + push**，不攒到最后
- 语言：TypeScript（脚本），Markdown（模板/文档）
- 不依赖任何第三方 AI SDK，脚本只做解析和写文件
- 路径全部支持 `~` 展开，兼容不同用户环境
- 每个脚本独立可运行，不强耦合

---

## 八、项目元信息

- **仓库**：`/Users/erik/development/qijuzhu`（GitHub: qijuzhu）
- **目标形态**：AgentSkill，兼容 Claude Code / OpenClaw / Codex
- **输出目录默认值**：`~/ai-memory/`
- **项目启动**：2026-04-20
