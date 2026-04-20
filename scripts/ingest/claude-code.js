/**
 * Claude Code 日志解析器
 * 路径：~/.claude/projects/<project-hash>/<session-id>.jsonl
 * 聚合：取每个 session 当日最后一条 assistant usage（累计值）
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { expandHome } from '../config.js';

// -Users-erik-development-qijuzhu → qijuzhu
function parseProjectName(dirName) {
  const reconstructed = dirName.replace(/^-/, '/').replace(/-/g, '/');
  return path.basename(reconstructed) || dirName;
}

async function parseSession(filePath, dateStr) {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });

  let lastUsage = null;
  let firstUserMessage = '';
  let model = '';
  let startTime = '';
  let endTime = '';

  for await (const line of rl) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }

    const ts = obj.timestamp || '';
    if (!ts.startsWith(dateStr)) continue;
    if (!startTime) startTime = ts;
    endTime = ts;

    if (obj.type === 'user' && !firstUserMessage) {
      const content = obj.message?.content;
      if (typeof content === 'string') {
        firstUserMessage = content.slice(0, 120);
      } else if (Array.isArray(content)) {
        const text = content.find(c => c.type === 'text');
        firstUserMessage = (text?.text || '').slice(0, 120);
      }
    }

    if (obj.type === 'assistant' && obj.message?.usage) {
      lastUsage = obj.message.usage;
      if (obj.message.model) model = obj.message.model;
    }
  }

  if (!lastUsage) return null;

  const input = lastUsage.input_tokens ?? 0;
  const output = lastUsage.output_tokens ?? 0;
  const cacheCreate = lastUsage.cache_creation_input_tokens ?? 0;
  const cacheRead = lastUsage.cache_read_input_tokens ?? 0;

  return {
    sessionId: path.basename(filePath, '.jsonl'),
    project: parseProjectName(path.basename(path.dirname(filePath))),
    model,
    inputTokens: input,
    outputTokens: output,
    cacheCreationTokens: cacheCreate,
    cacheReadTokens: cacheRead,
    totalTokens: input + output,
    firstUserMessage,
    startTime,
    endTime,
  };
}

export async function ingestClaudeCode(basePath = '~/.claude/projects', date = new Date()) {
  const dateStr = date.toISOString().slice(0, 10);
  const expanded = expandHome(basePath);
  const empty = {
    tool: 'claude_code', date: dateStr, sessions: [],
    totals: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0, sessionCount: 0, cacheHitRate: 0 },
  };

  if (!fs.existsSync(expanded)) return empty;

  const sessions = [];

  for (const projectDir of fs.readdirSync(expanded)) {
    const projectPath = path.join(expanded, projectDir);
    if (!fs.statSync(projectPath).isDirectory()) continue;

    for (const file of fs.readdirSync(projectPath)) {
      if (!file.endsWith('.jsonl')) continue;
      const filePath = path.join(projectPath, file);
      if (fs.statSync(filePath).mtime.toISOString().slice(0, 10) < dateStr) continue;

      const session = await parseSession(filePath, dateStr);
      if (session) sessions.push(session);
    }
  }

  const t = sessions.reduce((acc, s) => ({
    inputTokens: acc.inputTokens + s.inputTokens,
    outputTokens: acc.outputTokens + s.outputTokens,
    cacheCreationTokens: acc.cacheCreationTokens + s.cacheCreationTokens,
    cacheReadTokens: acc.cacheReadTokens + s.cacheReadTokens,
    totalTokens: acc.totalTokens + s.totalTokens,
    sessionCount: acc.sessionCount + 1,
    cacheHitRate: 0,
  }), { ...empty.totals });

  const denominator = t.inputTokens + t.cacheReadTokens + t.cacheCreationTokens;
  t.cacheHitRate = denominator > 0 ? Math.round((t.cacheReadTokens / denominator) * 1000) / 10 : 0;

  return { tool: 'claude_code', date: dateStr, sessions, totals: t };
}
