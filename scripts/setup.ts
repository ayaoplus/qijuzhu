#!/usr/bin/env tsx
/**
 * 起居注初始化脚本
 * - 首次运行：自动探测工具路径 → 创建输出目录 → 写入配置
 * - 再次运行：health check
 */
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { CONFIG_PATH, QijuConfig, expandHome, loadConfig } from './config.js';

const DEFAULT_CONFIG_PATH = new URL('../config/default.yaml', import.meta.url).pathname;

function detect(toolPath: string): boolean {
  return fs.existsSync(expandHome(toolPath));
}

function healthCheck(config: QijuConfig): void {
  console.log('\n=== 起居注 Health Check ===\n');

  const outputOk = fs.existsSync(expandHome(config.output_root));
  console.log(`输出目录   ${outputOk ? '✅' : '❌'} ${config.output_root}`);

  const tools: [string, string][] = [
    ['Claude Code', config.tools.claude_code.path],
    ['Codex      ', config.tools.codex.path],
    ['OpenClaw   ', config.tools.openclaw.path],
  ];
  const keys: (keyof QijuConfig['tools'])[] = ['claude_code', 'codex', 'openclaw'];

  for (let i = 0; i < tools.length; i++) {
    const [label, p] = tools[i];
    const enabled = config.tools[keys[i]].enabled;
    if (!enabled) {
      console.log(`${label}  ⏭️  已禁用`);
      continue;
    }
    const ok = detect(p);
    console.log(`${label}  ${ok ? '✅' : '⚠️ '} ${p}${ok ? '' : '  ← 路径不存在，请检查配置'}`);
  }

  console.log(`\n摘要模式   ${config.summary.mode}${config.summary.mode === 'full' ? ` (${config.summary.model})` : ''}`);
  console.log(`Cron       ${config.cron.enabled ? config.cron.times.join(', ') : '已禁用'}`);
  console.log(`\n配置文件：${CONFIG_PATH}`);
}

function run(): void {
  const existing = loadConfig();

  if (existing) {
    console.log('配置已存在，执行 health check...');
    healthCheck(existing);
    return;
  }

  console.log('首次运行，自动探测工具路径...\n');

  // 读默认配置作为基础
  const base = yaml.load(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf-8')) as QijuConfig;

  // 自动探测并设置 enabled
  base.tools.claude_code.enabled = detect(base.tools.claude_code.path);
  base.tools.codex.enabled = detect(base.tools.codex.path);
  base.tools.openclaw.enabled = detect(base.tools.openclaw.path);

  // 写配置
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, yaml.dump(base, { indent: 2 }));
  console.log(`✅ 配置已写入: ${CONFIG_PATH}`);

  // 建输出目录
  const outputRoot = expandHome(base.output_root);
  fs.mkdirSync(path.join(outputRoot, 'daily'), { recursive: true });
  fs.mkdirSync(path.join(outputRoot, 'memory'), { recursive: true });
  console.log(`✅ 输出目录已创建: ${outputRoot}`);

  // 从模板创建 index.md 和 profile.md（不覆盖已有文件）
  const templateDir = new URL('../templates', import.meta.url).pathname;
  for (const tpl of ['index.md', 'profile.md']) {
    const dest = path.join(outputRoot, tpl);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(templateDir, tpl), dest);
      console.log(`✅ 已创建: ${dest}`);
    }
  }

  healthCheck(base);
}

run();
