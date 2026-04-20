/**
 * OpenClaw 日志解析器
 * 路径：~/.openclaw/agents/<agentId>/sessions/<session-id>.jsonl
 * 聚合：累加每条 assistant 消息的 usage（非累计值）
 * 特点：有 USD 费用字段
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { expandHome } from '../config.js';

export interface OpenClawSession {
  sessionId: string;
  agentId: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  costUsd: number;
  firstUserMessage: string;
  startTime: string;
  endTime: string;
}

export interface OpenClawIngestResult {
  tool: 'openclaw';
  date: string;
  sessions: OpenClawSession[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    totalTokens: number;
    costUsd: number;
    sessionCount: number;
  };
}

async function parseOpenClawSession(filePath: string, dateStr: string): Promise<OpenClawSession | null> {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });

  let sessionId = path.basename(filePath, '.jsonl');
  let model = '';
  let provider = '';
  let firstUserMessage = '';
  let startTime = '';
  let endTime = '';
  let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheWrite = 0, totalCost = 0;
  let hasData = false;

  for await (const line of rl) {
    if (!line.trim()) continue;
    let obj: Record<string, unknown>;
    try { obj = JSON.parse(line); } catch { continue; }

    const ts = (obj.timestamp as string) || '';

    // 首行 session 元数据
    if (obj.type === 'session') {
      sessionId = (obj.id as string) || sessionId;
      if (!startTime) startTime = ts;
      continue;
    }

    if (!ts.startsWith(dateStr)) continue;
    endTime = ts;

    if (obj.type === 'message') {
      const msg = obj.message as Record<string, unknown>;
      if (!msg) continue;

      // 取第一条用户消息
      if (msg.role === 'user' && !firstUserMessage) {
        const content = msg.content;
        if (Array.isArray(content)) {
          const text = (content as Record<string, unknown>[]).find(c => c.type === 'text');
          firstUserMessage = ((text?.text as string) || '').slice(0, 120);
        } else if (typeof content === 'string') {
          firstUserMessage = content.slice(0, 120);
        }
      }

      // 累加每条 assistant usage
      if (msg.role === 'assistant' && msg.usage) {
        const usage = msg.usage as Record<string, unknown>;
        totalInput += (usage.input as number) ?? 0;
        totalOutput += (usage.output as number) ?? 0;
        totalCacheRead += (usage.cacheRead as number) ?? 0;
        totalCacheWrite += (usage.cacheWrite as number) ?? 0;
        const cost = usage.cost as Record<string, number> | undefined;
        totalCost += cost?.total ?? 0;
        if (!model && msg.model) model = msg.model as string;
        if (!provider && msg.provider) provider = msg.provider as string;
        hasData = true;
      }
    }
  }

  if (!hasData) return null;

  return {
    sessionId,
    agentId: '',
    model,
    provider,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cacheReadTokens: totalCacheRead,
    cacheWriteTokens: totalCacheWrite,
    totalTokens: totalInput + totalOutput,
    costUsd: Math.round(totalCost * 10000) / 10000,
    firstUserMessage,
    startTime,
    endTime,
  };
}

export async function ingestOpenClaw(
  basePath = '~/.openclaw/agents',
  date = new Date(),
): Promise<OpenClawIngestResult> {
  const dateStr = date.toISOString().slice(0, 10);
  const expanded = expandHome(basePath);

  const empty: OpenClawIngestResult = {
    tool: 'openclaw', date: dateStr, sessions: [],
    totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, costUsd: 0, sessionCount: 0 },
  };

  if (!fs.existsSync(expanded)) return empty;

  const sessions: OpenClawSession[] = [];

  for (const agentId of fs.readdirSync(expanded)) {
    const sessionsPath = path.join(expanded, agentId, 'sessions');
    if (!fs.existsSync(sessionsPath)) continue;

    for (const file of fs.readdirSync(sessionsPath)) {
      if (!file.endsWith('.jsonl')) continue;
      const filePath = path.join(sessionsPath, file);
      if (fs.statSync(filePath).mtime.toISOString().slice(0, 10) < dateStr) continue;

      const session = await parseOpenClawSession(filePath, dateStr);
      if (session) {
        session.agentId = agentId;
        sessions.push(session);
      }
    }
  }

  const t = sessions.reduce(
    (acc, s) => ({
      inputTokens: acc.inputTokens + s.inputTokens,
      outputTokens: acc.outputTokens + s.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + s.cacheReadTokens,
      cacheWriteTokens: acc.cacheWriteTokens + s.cacheWriteTokens,
      totalTokens: acc.totalTokens + s.totalTokens,
      costUsd: acc.costUsd + s.costUsd,
      sessionCount: acc.sessionCount + 1,
    }),
    empty.totals,
  );
  t.costUsd = Math.round(t.costUsd * 10000) / 10000;

  return { tool: 'openclaw', date: dateStr, sessions, totals: t };
}
