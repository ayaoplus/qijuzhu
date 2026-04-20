#!/usr/bin/env node
/**
 * 起居注初始化脚本
 * - 首次运行：自动探测工具路径 → 创建输出目录 → 写入配置
 * - 再次运行：health check
 */
import fs from 'fs';
import path from 'path';
import { CONFIG_PATH, expandHome, loadConfig } from './config.js';

const DEFAULT_CONFIG = new URL('../config/default.json', import.meta.url).pathname;
const TEMPLATES_DIR = new URL('../templates', import.meta.url).pathname;

function detect(toolPath) {
  return fs.existsSync(expandHome(toolPath));
}

function healthCheck(config) {
  console.log('\n=== 起居注 Health Check ===\n');

  const outputOk = fs.existsSync(expandHome(config.output_root));
  console.log(`输出目录     ${outputOk ? '✅' : '❌'} ${config.output_root}`);

  const tools = [
    ['Claude Code', 'claude_code'],
    ['Codex      ', 'codex'],
    ['OpenClaw   ', 'openclaw'],
  ];

  for (const [label, key] of tools) {
    const tool = config.tools[key];
    if (!tool.enabled) {
      console.log(`${label}  ⏭️  已禁用`);
      continue;
    }
    const ok = detect(tool.path);
    console.log(`${label}  ${ok ? '✅' : '⚠️ '} ${tool.path}${ok ? '' : '  ← 路径不存在，请检查配置'}`);
  }

  console.log(`\n摘要模式     ${config.summary.mode}${config.summary.mode === 'full' ? ` (${config.summary.model})` : ''}`);
  console.log(`Cron         ${config.cron.enabled ? config.cron.times.join(', ') : '已禁用'}`);
  console.log(`\n配置文件：${CONFIG_PATH}`);
}

function run() {
  const existing = loadConfig();

  if (existing) {
    console.log('配置已存在，执行 health check...');
    healthCheck(existing);
    return;
  }

  console.log('首次运行，自动探测工具路径...\n');

  const base = JSON.parse(fs.readFileSync(DEFAULT_CONFIG, 'utf-8'));

  base.tools.claude_code.enabled = detect(base.tools.claude_code.path);
  base.tools.codex.enabled = detect(base.tools.codex.path);
  base.tools.openclaw.enabled = detect(base.tools.openclaw.path);

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(base, null, 2));
  console.log(`✅ 配置已写入: ${CONFIG_PATH}`);

  const outputRoot = expandHome(base.output_root);
  fs.mkdirSync(path.join(outputRoot, 'daily'), { recursive: true });
  fs.mkdirSync(path.join(outputRoot, 'memory'), { recursive: true });
  console.log(`✅ 输出目录已创建: ${outputRoot}`);

  for (const tpl of ['index.md', 'profile.md']) {
    const dest = path.join(outputRoot, tpl);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(TEMPLATES_DIR, tpl), dest);
      console.log(`✅ 已创建: ${dest}`);
    }
  }

  healthCheck(base);
}

run();
