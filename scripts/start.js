#! /usr/bin/env node
const { spawn } = require('child_process');
const { writeFileSync } = require('fs');
const { join } = require('path');
let logPath = `/var/log/`;
if (process.platform === 'win32') {
  logPath = join(__dirname, '../log');
}

const logPathEnv = process.env.VAN_BLOG_LOG;
if (logPathEnv) {
  logPath = logPathEnv;
}

const printLog = (string, isError = false) => {
  const logName = `vanblog-${isError ? 'stderr' : 'stdout'}.log`;
  const logNameNormal = `vanblog-stdio.log`;
  writeFileSync(join(logPath, logName), string, { flag: 'a' });
  writeFileSync(join(logPath, logNameNormal), string, { flag: 'a' });
};

printLog(`[vanblog] 启动服务...`, false);
printLog(`[vanblog] 环境变量:`, false);
printLog(
  `[vanblog] MongoDB URL: ${process.env.VAN_BLOG_DATABASE_URL || 'mongodb://mongo:27017/vanBlog?authSource=admin'}`,
  false,
);
printLog(`[vanblog] Website Host: ${process.env.WEBSITE_HOST || 'not set'}`, false);
printLog(`[vanblog] Port: ${process.env.PORT || '3001'}`, false);
printLog(`[vanblog] 服务配置:`, false);
printLog(
  `[vanblog] - Admin URL: ${process.env.VAN_BLOG_ADMIN_URL || 'http://127.0.0.1:3002'}`,
  false,
);
printLog(
  `[vanblog] - Server URL: ${process.env.VAN_BLOG_SERVER_URL || 'http://127.0.0.1:3000'}`,
  false,
);
printLog(
  `[vanblog] - Website URL: ${process.env.VAN_BLOG_WEBSITE_URL || 'http://127.0.0.1:3001'}`,
  false,
);
printLog(
  `[vanblog] - Waline URL: ${process.env.VAN_BLOG_WALINE_URL || 'http://127.0.0.1:8360'}`,
  false,
);
printLog(
  `[vanblog] - Public Server URL: ${process.env.NEXT_PUBLIC_VANBLOG_SERVER_URL || 'window.location.origin'}`,
  false,
);

const ctx = spawn('node', ['main.js'], {
  cwd: '/app/server',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
  },
});
ctx.on('exit', () => {
  process.stderr.write(`[vanblog] 已停止`);
});
ctx.stdout.on('data', (data) => {
  printLog(data.toString(), false);
  process.stdout.write(data.toString());
});
ctx.stderr.on('data', (data) => {
  printLog(data.toString(), true);
  process.stderr.write(data.toString());
});
process.on('SIGINT', async () => {
  ctx.unref();
  process.kill(-ctx.pid, 'SIGINT');
  console.log('检测到关闭信号，优雅退出！');
  process.exit();
});
