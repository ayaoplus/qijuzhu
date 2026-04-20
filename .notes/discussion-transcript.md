# 起居注 · 前期讨论记录

> 这是用户 ayao 在 Cowork 里和 AI 讨论 qiju 项目时的对话整理（2026-04-20）。
> 不是逐字原文，是关键要点的重构。CLAUDE.md 是这段讨论的结论版。
> 如果 Claude Code 读 CLAUDE.md 时有理解不到位的地方，这里是补充。

---

## 第一轮：需求提出

**用户：**

希望让 AI 融入日常工作。每天大部分时间在电脑旁：
- OpenClaw —— 日常采集、信息收集
- Claude Code —— 编程
- CodeX —— 编程

想让 AI 长期了解他每天发生什么、做什么工作，积累之后能给出真实的、甚至预测性的建议。

"最好简单一点，能融入生活。"可以写程序、可以做 skill。想先讨论再落地。

**AI 回应要点：**

核心问题拆成三件事：
1. **记什么**：不能全记。有价值的是决定、卡点、对话、想法、状态。代码细节和搜索记录反而是噪音。
2. **怎么记**：全自动采集最终都会失败（隐私/噪音）。可持续的是"低摩擦主动输入 + 结构化数据自动补充"。
3. **怎么让三个工具共享同一份记忆**：大家都读本地文件，固定一个目录，每个工具通过各自配置（CLAUDE.md / AGENTS.md）指过去就行。

**提议的最简架构**：一个本地文件夹（如 `~/ai-memory/`），含 `profile.md`（底色）、`daily/YYYY-MM-DD.md`（每日）、`weekly/YYYY-Www.md`（每周自动汇编）、`projects/<name>.md`（项目上下文）、`index.md`（入口）。三个 AI 工具都通过配置文件指向它。

**捕获方式建议**：定时任务（每天 18:00 问三个问题："做了什么 / 卡在哪 / 明天干嘛"，3 分钟）+ 随手对 AI 说一句让它追加到当天 daily。**被动自动抓取**（git / 浏览器历史等）先不做，成本高且越界。

**定期整合**：光记不整理半年后就是废话堆。正好有 `consolidate-memory` 这个 skill，每周日自动跑一次，压缩 daily 成 weekly。

**关于预测性建议**：需要足够历史（2-3 个月起）+ 明确询问方式。AI 不会自己主动预测，要用户问。所以日志质量决定未来建议质量，初期多写"为什么"比"是什么"更值钱。

---

## 第二轮：自动记录 AI 活动的可行性

**用户：**

先不着急落地。追问一个问题：每天使用 AI 工作时，AI 干了什么，能不能**自动记录**？甚至**用了多少 token**？

**AI 回应要点：**

能做。按工具拆：

- **Claude Code**：`~/.claude/projects/<项目名>/<session-id>.jsonl`，每行是消息，`usage` 字段有精确 token 数（input / output / cache）。hooks 机制可挂 SessionEnd 实时处理。社区有 `ccusage` 可参考。
- **CodeX**：`~/.codex/sessions/`，JSONL，token 字段名和 Claude Code 不同，要单独适配。
- **Cowork**：通过 `list_sessions` + `read_transcript` 能拿到；也可能直接读本地存储。
- **OpenClaw**：不确定是什么工具，需要用户澄清日志位置。
- **账户级用量**：Anthropic Console / OpenAI Platform 有官方数字，但不知道"在干嘛"。语义要从本地 transcript 里挖。

**做法**：一个每日定时脚本扫过去 24h 各工具 session 文件 → 每段 AI 摘要 3-5 行 → 累加 token / 时长 → 写 `ai-activity/YYYY-MM-DD.md`。

**用户必须拍板的取舍**：
1. 隐私边界（transcripts 里可能有 API key、吐槽，自动过滤哪些？原始 jsonl 留不留？）
2. 实时（每次 SessionEnd hook）vs 批量（每晚定时）—— 建议先批量。
3. 摘要模型（Haiku 便宜？还是按需计算？）
4. 粒度（每 session 一条 vs 按"工作块"聚合）

三个决策项待用户回答：
- 每日报告放进 `~/ai-memory/daily/` 还是单独 `~/ai-activity/`？
- OpenClaw 具体是什么？日志在哪？
- token 粒度要到多细（只看总数 / 按项目 / 按模型 / 按时段）？

---

## 第三轮：命名与 skill 化

**用户：**

先不急着落地。帮忙想个名字，想做成 skill。

**AI 回应要点：**

几个方向：
- **起居注（qijuzhu）** —— 推荐。古代官职专门记录皇帝日常言行。这个项目结构上正是现代版：每日记录 → 汇编 → 长期成史。独特、有分量、天然分层（daily 是起居注原文、weekly/monthly 是"实录"、再往上是"本纪"）。
- **shilu / 实录** —— 起居注的下一层，"据实记载"。偏官方、结果导向。
- **scribe** —— 英文"抄录者"。简洁但平淡。
- **chronicle / chronicler** —— 语义最贴合但字长。
- **手帐 / shouzhang** —— 日系，偏个人、偏轻盈。和硬核自动抓 token 功能不太搭。

**推荐：起居注，skill 名 `qiju`**。三个理由：精确（不是日记、不是日志，是"贴身记录一个人"）、天然分层（目录结构直接给了）、有意思（"我的起居注又更新了一条"比"我的 daily-log 又 append 了一行"感觉不同）。

---

## 第四轮：讨论 → Claude Code 的交接

**用户：**

接着的问题：我们在 Cowork 讨论，然后想让 Claude Code 写代码时，怎么把讨论和记忆转移过去？

**AI 回应要点：**

这正是 `qiju` 要长期解决的问题，只不过这次要手动"引导"一次。

三种方式：

1. **写一份交接文档**（markdown）—— 最干净。AI 把讨论结果过滤、结构化。坏处是如果漏了细节你才发现。
2. **导出完整 transcript** —— 零信息损失。坏处是噪音多。
3. **放 CLAUDE.md 到项目根目录** —— Claude Code 启动自动读，不需要手动提示。最丝滑。

**推荐：1 + 3 组合**：写 `CLAUDE.md` 放项目根，同时把完整讨论导为 `.notes/discussion-transcript.md`。Claude Code 默认读精华，需要时可以翻原文。

**彩蛋**：未来 qiju 建好后，交接会自动化：
- Cowork 里讨论完，把结论追加到 `~/ai-memory/projects/qiju.md`
- 各 AI 的配置文件里都有"先读 `~/ai-memory/`"
- 三个 AI 之间不再有断点，读同一本起居注

今天这次手动交接，相当于给 qiju 自己交接它自己的出生。

---

## 第五轮：落地执行

**用户：**

我在 `/Users/erik/development/qijuzhu` 创建了目录。你处理一下，我稍后在这个目录启动 Claude Code。

**AI 动作：**

- 挂载目录
- 写 `CLAUDE.md`（交接主文档）
- 写 `.notes/discussion-transcript.md`（本文件）
- 准备让用户在该目录启动 Claude Code

---

## 对 Claude Code 的嘱托

读到这里说明你把 CLAUDE.md 和本补充都看完了。几点再强调：

1. 用户节奏是"讨论清楚再动"，不喜欢跳过设计直接写代码。
2. 目前**所有"架构"都是草案**，开放决策没定。先问，再做。
3. 项目名 `qiju`，仓库 `qijuzhu`。skill 最终落到 `~/.claude/skills/qiju/`（开放决策）。
4. 记忆目录位置、skill/数据是否分离、check-in 方式、OpenClaw 是什么 —— 这四个没答案前，骨架都可以画，但不要动手写核心代码。
5. 用中文和用户交流。
