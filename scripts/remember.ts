#!/usr/bin/env tsx
/**
 * 记忆写入工具
 * 将一段文字追加到当月记忆文件 ~/ai-memory/memory/YYYY-MM.md
 *
 * 用法：
 *   npm run remember -- "今天意识到..."
 *   echo "..." | npm run remember
 */
import fs from 'fs';
import path from 'path';
import { requireConfig, expandHome } from './config.js';

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  return new Promise(resolve => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
  });
}

async function run(): Promise<void> {
  const config = requireConfig();

  const argContent = process.argv.slice(2).join(' ').trim();
  const stdinContent = await readStdin();
  const content = argContent || stdinContent;

  if (!content) {
    console.error('用法：npm run remember -- "要记录的内容"');
    process.exit(1);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const monthStr = dateStr.slice(0, 7);

  const memoryDir = path.join(expandHome(config.output_root), 'memory');
  fs.mkdirSync(memoryDir, { recursive: true });

  const memoryFile = path.join(memoryDir, `${monthStr}.md`);

  if (!fs.existsSync(memoryFile)) {
    fs.writeFileSync(memoryFile, `# 记忆 ${monthStr}\n`, 'utf-8');
  }

  // 同一天多条记录不重复写日期标题
  const existing = fs.readFileSync(memoryFile, 'utf-8');
  const dateHeader = `### ${dateStr}`;
  const entry = existing.includes(dateHeader)
    ? `\n${content}`
    : `\n${dateHeader}\n\n${content}`;

  fs.appendFileSync(memoryFile, entry + '\n', 'utf-8');
  console.log(`✅ 已记录到 ${memoryFile}`);
}

run();
