import * as vscode from "vscode";

import { TERMINAL_NAME } from "./constants";

export function runCommandInProjectTerminal(
  cwd: string,
  command: string
): void {
  const existing = vscode.window.terminals.find((t) => t.name === TERMINAL_NAME);
  const terminal = existing ?? vscode.window.createTerminal({ name: TERMINAL_NAME, cwd });

  terminal.show();
  terminal.sendText(command, true);
}
