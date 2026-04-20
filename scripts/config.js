/**
 * 配置加载与路径工具（共享模块）
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

export const CONFIG_PATH = path.join(os.homedir(), '.qiju', 'config.json');

export function expandHome(p) {
  return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
}

/** 加载配置，不存在时返回 null */
export function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

/** 加载配置，不存在时退出并提示 */
export function requireConfig() {
  const config = loadConfig();
  if (!config) {
    console.error('❌ 配置文件不存在，请先运行: node scripts/setup.js');
    process.exit(1);
  }
  return config;
}

/** 数字加千分位 */
export function fmt(n) {
  return n.toLocaleString('en-US');
}
