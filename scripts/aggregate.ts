#!/usr/bin/env tsx
/**
 * 每日汇总入口
 * 用法：
 *   npm run aggregate              # 汇总今天
 *   npm run aggregate -- 2026-04-19  # 汇总指定日期
 */
import fs from 'fs';
import path from 'path';
import { requireConfig, expandHome, fmt } from './config.js';
import { ingestClaudeCode, ClaudeSession } from './ingest/claude-code.js';
import { ingestCodex } from './ingest/codex.js';
import { ingestOpenClaw } from './ingest/openclaw.js';

function parseDate(arg?: string): Date {
  if (!arg) return new Date();
  const d = new Date(arg + 'T00:00:00');
  if (isNaN(d.getTime())) {
    console.error(`无效日期：${arg}，格式应为 YYYY-MM-DD`);
    process.exit(1);
  }
  return d;
}

// 按项目分组 Claude Code sessions
function groupByProject(sessions: ClaudeSession[]): Map<string, ClaudeSession[]> {
  const map = new Map<string, ClaudeSession[]>();
  for (const s of sessions) {
    if (!map.has(s.project)) map.set(s.project, []);
    map.get(s.project)!.push(s);
  }
  return map;
}

function buildMarkdown(
  dateStr: string,
  claude: Awaited<ReturnType<typeof ingestClaudeCode>>,
  codex: Awaited<ReturnType<typeof ingestCodex>>,
  openclaw: Awaited<ReturnType<typeof ingestOpenClaw>>,
): string {
  const ct = claude.totals;
  const dt = codex.totals;
  const ot = openclaw.totals;

  const totalSessions = ct.sessionCount + dt.sessionCount + ot.sessionCount;
  const totalInput = ct.inputTokens + dt.inputTokens + ot.inputTokens;
  const totalOutput = ct.outputTokens + dt.outputTokens + ot.outputTokens;
  const totalCache = ct.cacheReadTokens + dt.cachedInputTokens + ot.cacheReadTokens;
  const totalTokens = ct.totalTokens + dt.totalTokens + ot.totalTokens;

  const lines: string[] = [];

  lines.push(`# ${dateStr} AI 活动日报\n`);

  // Token 汇总表
  lines.push('## Token 汇总\n');
  lines.push('| 工具 | Sessions | Input | Output | Cache | Total | 费用 |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|');

  if (ct.sessionCount > 0) {
    lines.push(`| Claude Code | ${ct.sessionCount} | ${fmt(ct.inputTokens)} | ${fmt(ct.outputTokens)} | ${fmt(ct.cacheReadTokens)} | ${fmt(ct.totalTokens)} | - |`);
  }
  if (dt.sessionCount > 0) {
    lines.push(`| Codex | ${dt.sessionCount} | ${fmt(dt.inputTokens)} | ${fmt(dt.outputTokens)} | ${fmt(dt.cachedInputTokens)} | ${fmt(dt.totalTokens)} | - |`);
  }
  if (ot.sessionCount > 0) {
    const costStr = ot.costUsd > 0 ? `$${ot.costUsd.toFixed(4)}` : '-';
    lines.push(`| OpenClaw | ${ot.sessionCount} | ${fmt(ot.inputTokens)} | ${fmt(ot.outputTokens)} | ${fmt(ot.cacheReadTokens)} | ${fmt(ot.totalTokens)} | ${costStr} |`);
  }

  lines.push(`| **合计** | **${totalSessions}** | **${fmt(totalInput)}** | **${fmt(totalOutput)}** | **${fmt(totalCache)}** | **${fmt(totalTokens)}** | ${ot.costUsd > 0 ? `**$${ot.costUsd.toFixed(4)}**` : '-'} |`);

  if (ct.cacheHitRate > 0) {
    const rate = ct.cacheHitRate;
    lines.push(`\nCache 命中率（Claude Code）：${rate.toFixed(1)}%`);
  }

  // Claude Code 按项目
  if (claude.sessions.length > 0) {
    lines.push('\n## Claude Code — 今日项目\n');
    const byProject = groupByProject(claude.sessions);
    for (const [project, sessions] of byProject) {
      const firstMsg = sessions[0]?.firstUserMessage?.replace(/\n/g, ' ') || '';
      const preview = firstMsg ? `：${firstMsg}${firstMsg.length >= 120 ? '…' : ''}` : '';
      lines.push(`- **${project}**（${sessions.length} sessions）${preview}`);
    }
  }

  // Codex
  if (codex.sessions.length > 0) {
    lines.push('\n## Codex — 今日工作\n');
    for (const s of codex.sessions) {
      const modelStr = s.model ? ` / ${s.model}` : '';
      lines.push(`- ${s.sessionId.slice(0, 19)}${modelStr}（${fmt(s.totalTokens)} tokens）`);
    }
  }

  // OpenClaw
  if (openclaw.sessions.length > 0) {
    lines.push('\n## OpenClaw — 今日工作\n');
    for (const s of openclaw.sessions) {
      const modelStr = s.model ? ` / ${s.model}` : '';
      const preview = s.firstUserMessage ? `：${s.firstUserMessage.replace(/\n/g, ' ')}…` : '';
      lines.push(`- **${s.agentId}**${modelStr}（${fmt(s.totalTokens)} tokens）${preview}`);
    }
  }

  if (totalSessions === 0) {
    lines.push('\n> 今日暂无 AI 活动记录。');
  }

  lines.push(`\n---\n*由 起居注 自动生成 · ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}*`);

  return lines.join('\n');
}

async function run(): Promise<void> {
  const config = requireConfig();
  const date = parseDate(process.argv[2]);
  const dateStr = date.toISOString().slice(0, 10);

  console.log(`正在汇总 ${dateStr} 的 AI 活动...\n`);

  const [claude, codex, openclaw] = await Promise.all([
    config.tools.claude_code.enabled
      ? ingestClaudeCode(config.tools.claude_code.path, date)
      : Promise.resolve({ tool: 'claude_code' as const, date: dateStr, sessions: [], totals: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0, sessionCount: 0, cacheHitRate: 0 } }),
    config.tools.codex.enabled
      ? ingestCodex(config.tools.codex.path, date)
      : Promise.resolve({ tool: 'codex' as const, date: dateStr, sessions: [], totals: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningOutputTokens: 0, totalTokens: 0, sessionCount: 0 } }),
    config.tools.openclaw.enabled
      ? ingestOpenClaw(config.tools.openclaw.path, date)
      : Promise.resolve({ tool: 'openclaw' as const, date: dateStr, sessions: [], totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, costUsd: 0, sessionCount: 0 } }),
  ]);

  console.log(`Claude Code: ${claude.totals.sessionCount} sessions, ${fmt(claude.totals.totalTokens)} tokens`);
  console.log(`Codex:       ${codex.totals.sessionCount} sessions, ${fmt(codex.totals.totalTokens)} tokens`);
  console.log(`OpenClaw:    ${openclaw.totals.sessionCount} sessions, ${fmt(openclaw.totals.totalTokens)} tokens`);

  const markdown = buildMarkdown(dateStr, claude, codex, openclaw);

  const outputDir = path.join(expandHome(config.output_root), 'daily');
  fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `${dateStr}.md`);
  fs.writeFileSync(outputFile, markdown, 'utf-8');

  console.log(`\n✅ 日报已写入: ${outputFile}`);
}

run();
