import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * 跨平台 Python 命令检测
 */
let cachedPythonCommand: string | null = null;

async function detectPythonCommand(): Promise<string> {
  if (cachedPythonCommand) return cachedPythonCommand;

  const isWindows = os.platform() === 'win32';
  const candidates = isWindows
    ? ['python', 'py', 'python3']
    : ['python3', 'python'];

  for (const cmd of candidates) {
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(cmd, ['--version'], {
          shell: false,
          stdio: 'pipe',
        });
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`exit ${code}`));
        });
        proc.on('error', reject);
      });
      cachedPythonCommand = cmd;
      console.log(`检测到 Python 命令: ${cmd}`);
      return cmd;
    } catch {
      continue;
    }
  }

  throw new Error(
    '未找到可用的 Python 解释器。请确保 Python 已安装并添加到 PATH。\n' +
    '下载地址: https://www.python.org/downloads/'
  );
}

/**
 * 获取不含中文的系统临时目录
 * 避免 Windows 控制台编码（GBK）损坏中文路径
 */
function getSafeTempDir(): string {
  // 优先用系统 TEMP，通常是 C:\Users\xxx\AppData\Local\Temp（纯英文）
  const sysTemp = process.env.TEMP || process.env.TMP || os.tmpdir();
  const dir = path.join(sysTemp, 'meeting-assistant');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 运行 Python 脚本并返回 stdout
 *
 * 关键：不再用 python -c 传脚本（中文路径会被 cmd.exe GBK 编码损坏），
 * 而是将脚本写入 UTF-8 的 .py 文件再执行。
 */
export async function runPythonScript(
  script: string,
  options?: { timeout?: number }
): Promise<{ stdout: string; stderr: string }> {
  const pythonCmd = await detectPythonCommand();
  const tempDir = getSafeTempDir();
  const scriptPath = path.join(tempDir, `script_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.py`);

  // 用 UTF-8 写入脚本文件，确保中文等非 ASCII 字符完整保留
  fs.writeFileSync(scriptPath, script, 'utf-8');

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonCmd, [scriptPath], {
      // 不启用 shell，避免 cmd.exe 干预编码
      shell: false,
      timeout: options?.timeout || 30000,
      env: {
        ...process.env,
        // 强制 Python 使用 UTF-8
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8');
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString('utf-8');
    });

    proc.on('close', (code) => {
      // 清理临时脚本文件
      try { fs.unlinkSync(scriptPath); } catch {}

      if (code !== 0) {
        reject(new Error(`Python 脚本执行失败 (exit ${code}): ${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });

    proc.on('error', (err) => {
      try { fs.unlinkSync(scriptPath); } catch {}
      reject(new Error(`无法启动 Python 进程: ${err.message}`));
    });
  });
}

/**
 * 在系统临时目录创建用于音频处理的临时文件路径（纯英文路径）
 */
export function createTempAudioPath(prefix: string): string {
  const tempDir = getSafeTempDir();
  return path.join(tempDir, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`);
}

/**
 * 将路径转为 Python 安全的格式
 */
export function toPythonSafePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}
