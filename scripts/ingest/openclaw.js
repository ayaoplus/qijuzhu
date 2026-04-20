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

async function parseOpenClawSession(filePath, dateStr) {
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
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }

    const ts = obj.timestamp || '';

    if (obj.type === 'session') {
      sessionId = obj.id || sessionId;
      if (!startTime) startTime = ts;
      continue;
    }

    if (!ts.startsWith(dateStr)) continue;
    endTime = ts;

    if (obj.type === 'message') {
      const msg = obj.message;
      if (!msg) continue;

      if (msg.role === 'user' && !firstUserMessage) {
        const content = msg.content;
        if (Array.isArray(content)) {
          const text = content.find(c => c.type === 'text');
          firstUserMessage = (text?.text || '').slice(0, 120);
        } else if (typeof content === 'string') {
          firstUserMessage = content.slice(0, 120);
        }
      }

      if (msg.role === 'assistant' && msg.usage) {
        const usage = msg.usage;
        totalInput += usage.input ?? 0;
        totalOutput += usage.output ?? 0;
        totalCacheRead += usage.cacheRead ?? 0;
        totalCacheWrite += usage.cacheWrite ?? 0;
        totalCost += usage.cost?.total ?? 0;
        if (!model && msg.model) model = msg.model;
        if (!provider && msg.provider) provider = msg.provider;
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

export async function ingestOpenClaw(basePath = '~/.openclaw/agents', date = new Date()) {
  const dateStr = date.toISOString().slice(0, 10);
  const expanded = expandHome(basePath);

  const empty = {
    tool: 'openclaw', date: dateStr, sessions: [],
    totals: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, costUsd: 0, sessionCount: 0 },
  };

  if (!fs.existsSync(expanded)) return empty;

  const sessions = [];

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

  const t = sessions.reduce((acc, s) => ({
    inputTokens: acc.inputTokens + s.inputTokens,
    outputTokens: acc.outputTokens + s.outputTokens,
    cacheReadTokens: acc.cacheReadTokens + s.cacheReadTokens,
    cacheWriteTokens: acc.cacheWriteTokens + s.cacheWriteTokens,
    totalTokens: acc.totalTokens + s.totalTokens,
    costUsd: acc.costUsd + s.costUsd,
    sessionCount: acc.sessionCount + 1,
  }), { ...empty.totals });

  t.costUsd = Math.round(t.costUsd * 10000) / 10000;
  return { tool: 'openclaw', date: dateStr, sessions, totals: t };
}
