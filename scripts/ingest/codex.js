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

async function parseCodexSession(filePath) {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });

  let maxTotal = -1;
  let bestUsage = null;
  let model = '';
  let startTime = '';
  let endTime = '';

  for await (const line of rl) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }

    if (obj.type !== 'event_msg') continue;
    const payload = obj.payload;
    if (!payload || payload.type !== 'token_count') continue;
    const info = payload.info;
    if (!info) continue;

    const ts = obj.timestamp || '';
    if (!startTime) startTime = ts;
    endTime = ts;

    const usage = info.total_token_usage;
    if (!usage) continue;

    const total = usage.total_tokens ?? 0;
    if (total > maxTotal) {
      maxTotal = total;
      bestUsage = usage;
      if (info.turn_context?.model) model = info.turn_context.model;
    }
  }

  if (!bestUsage) return null;

  return {
    sessionId: path.basename(filePath, '.jsonl').replace(/^rollout-/, ''),
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

export async function ingestCodex(basePath = '~/.codex/sessions', date = new Date()) {
  const dateStr = date.toISOString().slice(0, 10);
  const [year, month, day] = dateStr.split('-');
  const dayPath = path.join(expandHome(basePath), year, month, day);

  const empty = {
    tool: 'codex', date: dateStr, sessions: [],
    totals: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, reasoningOutputTokens: 0, totalTokens: 0, sessionCount: 0 },
  };

  if (!fs.existsSync(dayPath)) return empty;

  const sessions = [];
  for (const file of fs.readdirSync(dayPath)) {
    if (!file.endsWith('.jsonl') || !file.startsWith('rollout-')) continue;
    const session = await parseCodexSession(path.join(dayPath, file));
    if (session) sessions.push(session);
  }

  const t = sessions.reduce((acc, s) => ({
    inputTokens: acc.inputTokens + s.inputTokens,
    outputTokens: acc.outputTokens + s.outputTokens,
    cachedInputTokens: acc.cachedInputTokens + s.cachedInputTokens,
    reasoningOutputTokens: acc.reasoningOutputTokens + s.reasoningOutputTokens,
    totalTokens: acc.totalTokens + s.totalTokens,
    sessionCount: acc.sessionCount + 1,
  }), { ...empty.totals });

  return { tool: 'codex', date: dateStr, sessions, totals: t };
}
