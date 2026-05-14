import * as cp from "child_process";
import * as vscode from "vscode";
import { promisify } from "util";

import { CONFIG_SECTION } from "./constants";

const execFile = promisify(cp.execFile);

export type ExecResult = { stdout: string; stderr: string };

export function getShell(): string | undefined {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const shell = (cfg.get<string>("shellPath") ?? "").trim();
  return shell || undefined;
}

export async function runShellCommand(
  command: string,
  cwd?: string,
  env?: NodeJS.ProcessEnv
): Promise<ExecResult> {
  const shell = getShell() || process.env.SHELL || "/bin/sh";
  const args = ["-lc", command];
  const mergedEnv = { ...process.env, ...env };
  try {
    const { stdout, stderr } = await execFile(shell, args, {
      cwd,
      env: mergedEnv,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
    const stdout = e.stdout?.toString() ?? "";
    const stderr = e.stderr?.toString() ?? e.message ?? String(err);
    throw Object.assign(new Error(stderr || "Command failed"), { stdout, stderr });
  }
}

export async function runBinary(
  file: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv }
): Promise<ExecResult> {
  const mergedEnv = { ...process.env, ...options?.env };
  try {
    const { stdout, stderr } = await execFile(file, args, {
      cwd: options?.cwd,
      env: mergedEnv,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (err: unknown) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
    const stdout = e.stdout?.toString() ?? "";
    const stderr = e.stderr?.toString() ?? e.message ?? String(err);
    throw Object.assign(new Error(stderr || "Command failed"), { stdout, stderr });
  }
}
