/**
 * 配置加载与路径工具
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';

export const CONFIG_PATH = path.join(os.homedir(), '.qiju', 'config.yaml');

export interface ToolConfig {
  enabled: boolean;
  path: string;
}

export interface QijuConfig {
  output_root: string;
  tools: {
    claude_code: ToolConfig;
    codex: ToolConfig;
    openclaw: ToolConfig;
  };
  summary: {
    mode: 'basic' | 'full';
    model: string;
  };
  cron: {
    enabled: boolean;
    times: string[];
  };
}

export function expandHome(p: string): string {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

/** 加载配置，不存在时返回 null */
export function loadConfig(): QijuConfig | null {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  return yaml.load(fs.readFileSync(CONFIG_PATH, 'utf-8')) as QijuConfig;
}

/** 加载配置，不存在时抛出提示 */
export function requireConfig(): QijuConfig {
  const config = loadConfig();
  if (!config) {
    console.error('❌ 配置文件不存在，请先运行: npm run setup');
    process.exit(1);
  }
  return config;
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US');
}
