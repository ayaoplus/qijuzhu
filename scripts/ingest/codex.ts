/**
 * Codex 日志解析器
 * 路径：~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl
 * 聚合：过滤 type=event_msg + payload.type=token_count + payload.info!=null，
 *       取每个 session 最大 total_token_usage（累计值）
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { expandHome } from '../config.js';

export interface CodexSession {
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  startTime: string;
  endTime: string;
}

export interface CodexIngestResult {
  tool: 'codex';
  date: string;
  sessions: CodexSession[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    reasoningOutputTokens: number;
    totalTokens: number;
    sessionCount: number;
  };
}

async function parseCodexSession(filePath: string): Promise<CodexSession | null> {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });

  let maxTotal = -1;
  let bestUsage: Record<string, number> | null = null;
  let model = '';
  let startTime = '';
  let endTime = '';

  for await (const line of rl) {
    if (!line.trim()) continue;
    let obj: Record<string, unknown>;
    try { obj = JSON.parse(line); } catch { continue; }

    if (obj.type !== 'event_msg') continue;
    const payload = obj.payload as Record<string, unknown>;
    if (!payload || payload.type !== 'token_count') continue;
    const info = payload.info as Record<string, unknown> | null;
    if (!info) continue;

    const ts = (obj.timestamp as string) || '';
    if (!startTime) startTime = ts;
    endTime = ts;

    const usage = info.total_token_usage as Record<string, number>;
    if (!usage) continue;

    const total = usage.total_tokens ?? 0;
    if (total > maxTotal) {
      maxTotal = total;
      bestUsage = usage;
      const ctx = info.turn_context as Record<string, string> | undefined;
      if (ctx?.model) model = ctx.model;
    }
  }

  if (!bestUsage) return null;

  // session ID 从文件名提取：rollout-2026-04-20T10-36-28-<uuid>.jsonl → 日期部分
  const sessionId = path.basename(filePath, '.jsonl').replace(/^rollout-/, '');

  return {
    sessionId,
    model,
    inputTokens: bestUsage.input_tokens ?? 0,
    outputTokens: bestUsage.output_tokens ?? 0,
    cachedInputTokens: bestUsage.cached_input_tokens ?? 0,
    reasoningOutputTokens: bestUsage.reasoning_output_tokens ?? 0,
    totalTokens: maxTotal,
    startTime,
    endTime,
  };
}

export async function ingestCodex(
  basePath = '~/.codex/sessions',
  date = new Date(),
): Promise<CodexIngestResult> {
  const dateStr = date.toISOString().slice(0, 10);
  const [year, month, day] = dateStr.split('-');
  const dayPath = path.join(expandHome(basePath), year, month, day);

  const empty: CodexIngestResult = {
    tool: 'codex', date: dateStr, sessions: [],
    totals: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningOutputTokens: 0, totalTokens: 0, sessionCount: 0 },
  };

  if (!fs.existsSync(dayPath)) return empty;

  const sessions: CodexSession[] = [];

  for (const file of fs.readdirSync(dayPath)) {
    if (!file.endsWith('.jsonl') || !file.startsWith('rollout-')) continue;
    const session = await parseCodexSession(path.join(dayPath, file));
    if (session) sessions.push(session);
  }

  const t = sessions.reduce(
    (acc, s) => ({
      inputTokens: acc.inputTokens + s.inputTokens,
      outputTokens: acc.outputTokens + s.outputTokens,
      cachedInputTokens: acc.cachedInputTokens + s.cachedInputTokens,
      reasoningOutputTokens: acc.reasoningOutputTokens + s.reasoningOutputTokens,
      totalTokens: acc.totalTokens + s.totalTokens,
      sessionCount: acc.sessionCount + 1,
    }),
    empty.totals,
  );

  return { tool: 'codex', date: dateStr, sessions, totals: t };
}
