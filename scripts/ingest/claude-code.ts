/**
 * Claude Code 日志解析器
 * 路径：~/.claude/projects/<project-hash>/<session-id>.jsonl
 * 聚合：取每个 session 当日最后一条 assistant usage（累计值）
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { expandHome } from '../config.js';

export interface ClaudeSession {
  sessionId: string;
  project: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  firstUserMessage: string;
  startTime: string;
  endTime: string;
}

export interface ClaudeIngestResult {
  tool: 'claude_code';
  date: string;
  sessions: ClaudeSession[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalTokens: number;
    sessionCount: number;
    cacheHitRate: number;
  };
}

// -Users-erik-development-qijuzhu → qijuzhu
function parseProjectName(dirName: string): string {
  const reconstructed = dirName.replace(/^-/, '/').replace(/-/g, '/');
  return path.basename(reconstructed) || dirName;
}

async function parseSession(filePath: string, dateStr: string): Promise<ClaudeSession | null> {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });

  let lastUsage: Record<string, number> | null = null;
  let firstUserMessage = '';
  let model = '';
  let startTime = '';
  let endTime = '';

  for await (const line of rl) {
    if (!line.trim()) continue;
    let obj: Record<string, unknown>;
    try { obj = JSON.parse(line); } catch { continue; }

    const ts = (obj.timestamp as string) || '';
    if (!ts.startsWith(dateStr)) continue;
    if (!startTime) startTime = ts;
    endTime = ts;

    // 取第一条用户消息作为摘要
    if (obj.type === 'user' && !firstUserMessage) {
      const content = (obj.message as Record<string, unknown>)?.content;
      if (typeof content === 'string') {
        firstUserMessage = content.slice(0, 120);
      } else if (Array.isArray(content)) {
        const text = (content as Record<string, unknown>[]).find(c => c.type === 'text');
        firstUserMessage = ((text?.text as string) || '').slice(0, 120);
      }
    }

    // 记录最后一条 assistant usage
    if (obj.type === 'assistant') {
      const msg = obj.message as Record<string, unknown>;
      if (msg?.usage) {
        lastUsage = msg.usage as Record<string, number>;
        if (msg.model) model = msg.model as string;
      }
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

export async function ingestClaudeCode(
  basePath = '~/.claude/projects',
  date = new Date(),
): Promise<ClaudeIngestResult> {
  const dateStr = date.toISOString().slice(0, 10);
  const expanded = expandHome(basePath);
  const empty: ClaudeIngestResult = {
    tool: 'claude_code', date: dateStr, sessions: [],
    totals: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalTokens: 0, sessionCount: 0, cacheHitRate: 0 },
  };

  if (!fs.existsSync(expanded)) return empty;

  const sessions: ClaudeSession[] = [];

  for (const projectDir of fs.readdirSync(expanded)) {
    const projectPath = path.join(expanded, projectDir);
    if (!fs.statSync(projectPath).isDirectory()) continue;

    for (const file of fs.readdirSync(projectPath)) {
      if (!file.endsWith('.jsonl')) continue;
      const filePath = path.join(projectPath, file);
      // 用 mtime 做快速过滤，避免读太多旧文件
      if (fs.statSync(filePath).mtime.toISOString().slice(0, 10) < dateStr) continue;

      const session = await parseSession(filePath, dateStr);
      if (session) sessions.push(session);
    }
  }

  const t = sessions.reduce(
    (acc, s) => ({
      inputTokens: acc.inputTokens + s.inputTokens,
      outputTokens: acc.outputTokens + s.outputTokens,
      cacheCreationTokens: acc.cacheCreationTokens + s.cacheCreationTokens,
      cacheReadTokens: acc.cacheReadTokens + s.cacheReadTokens,
      totalTokens: acc.totalTokens + s.totalTokens,
      sessionCount: acc.sessionCount + 1,
      cacheHitRate: 0,
    }),
    empty.totals,
  );

  // cache hit rate = cacheRead / (input + cacheRead + cacheCreate)
  const denominator = t.inputTokens + t.cacheReadTokens + t.cacheCreationTokens;
  t.cacheHitRate = denominator > 0 ? Math.round((t.cacheReadTokens / denominator) * 1000) / 10 : 0;

  return { tool: 'claude_code', date: dateStr, sessions, totals: t };
}
