import * as cp from "child_process";
import * as vscode from "vscode";

import { getShell } from "./shell";

const CHANNEL_NAME = "RN Easy Emulator";

let channel: vscode.OutputChannel | undefined;

export function getOrCreateOutputChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel(CHANNEL_NAME);
  }
  return channel;
}

export function runCommandBackground(
  cwd: string,
  command: string,
  onExit: () => void,
): void {
  const ch = getOrCreateOutputChannel();
  ch.show(/* preserveFocus= */ true);
  ch.appendLine(`\n▶  ${command}\n`);

  const shell = getShell() || process.env.SHELL || "/bin/sh";

  const child = cp.spawn(shell, ["-lc", command], {
    cwd,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk: Buffer) => ch.append(chunk.toString()));
  child.stderr.on("data", (chunk: Buffer) => ch.append(chunk.toString()));

  child.on("close", (code) => {
    ch.appendLine(`\n■  Exited with code ${code ?? "?"}`);
    onExit();
  });

  child.on("error", (err) => {
    ch.appendLine(`\n✖  Failed to start: ${err.message}`);
    onExit();
  });
}
