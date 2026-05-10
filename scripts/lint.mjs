// 项目 lint 检查脚本
// 检查项：HTML 结构完整性、JS 全局变量冲突、console.log 残留

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

let errors = 0;
let warnings = 0;

function err(file, msg) {
  errors++;
  console.error(`  ERROR: ${file} - ${msg}`);
}
function warn(file, msg) {
  warnings++;
  console.warn(`  WARN:  ${file} - ${msg}`);
}

// ---- 1. HTML 文件检查 ----
const htmlFiles = readdirSync(root, { recursive: true })
  .filter((f) => f.endsWith('.html'))
  .map((f) => resolve(root, f));

for (const file of htmlFiles) {
  const rel = file.replace(root + '/', '').replace(root + '\\', '');
  const content = readFileSync(file, 'utf-8');

  // 检查 DOCTYPE
  if (!/^<!DOCTYPE html>/i.test(content.trimStart())) {
    err(rel, '缺少 DOCTYPE 声明');
  }

  // 检查 charset
  if (!/<meta[^>]+charset/i.test(content)) {
    err(rel, '缺少 charset meta 标签');
  }

  // 检查 viewport
  if (!/<meta[^>]+viewport/i.test(content)) {
    warn(rel, '缺少 viewport meta 标签');
  }
}

// ---- 2. JS 文件检查 ----
const jsFiles = readdirSync(root, { recursive: true })
  .filter((f) => f.endsWith('.js') && !f.includes('node_modules'))
  .map((f) => resolve(root, f));

// 收集所有 JS 文件中的全局函数/变量定义
const allGlobals = {};
for (const file of jsFiles) {
  const content = readFileSync(file, 'utf-8');
  // 匹配全局函数定义
  const funcDefs = content.matchAll(/function\s+(\w+)\s*\(/g);
  for (const m of funcDefs) {
    if (!allGlobals[m[1]]) allGlobals[m[1]] = [];
    allGlobals[m[1]].push(file.replace(root + '/', '').replace(root + '\\', ''));
  }
  // 匹配 var 全局变量（在顶层作用域）
  const varDefs = content.matchAll(/^var\s+(\w+)/gm);
  for (const m of varDefs) {
    if (!allGlobals[m[1]]) allGlobals[m[1]] = [];
    allGlobals[m[1]].push(file.replace(root + '/', '').replace(root + '\\', ''));
  }

  // 检查 console.log（排除 supabase-config.js）
  const rel2 = file.replace(root + '/', '').replace(root + '\\', '');
  if (rel2 !== 'js/supabase-config.js') {
    for (const m of content.matchAll(/console\.log\(/g)) {
      warn(rel2, '包含 console.log');
      break;
    }
  }
}

for (const [name, files] of Object.entries(allGlobals)) {
  if (files.length > 1) {
    // 排除已知共享函数（在 utils.js 中定义，其他地方引用）
    const sharedFns = new Set([
      'showToast',
      'showConfirm',
      'checkLogin',
      'getCurrentUser',
      'getToday',
      'guardAuth',
      'getCurrentSemesterId',
      'refreshCurrentUser',
      'logAction',
      'logout',
      'adminApi',
      'isLoggedIn',
      'waitForDb',
      'clearLoginState',
      'calcFormula',
      'getAccessibleGroupIds',
      'getParentOrgId',
      'getAllChildOrgs',
      'getDirectChildrenOrgs',
      'buildOrgNamePath',
      'getOrgFullPath',
      'getOrgDabanId',
      'getOrgClassId',
      'formatTimestamp',
      'formatDate',
      '_currentSemesterId'
    ]);
    if (sharedFns.has(name)) continue;
    err(`${name}`, `全局变量在多文件中定义: ${files.join(', ')}`);
  }
}

// ---- 结果 ----
console.log(`\nHTML: ${htmlFiles.length} 个, JS: ${jsFiles.length} 个`);
console.log(`错误: ${errors}, 警告: ${warnings}`);

if (errors > 0 || warnings > 0) {
  console.log(`\n请修复以上问题后重试。`);
  if (errors > 0) process.exit(1);
}
