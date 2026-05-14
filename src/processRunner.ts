import * as path from "path";
import * as vscode from "vscode";

/**
 * Runs the build command in a real integrated-terminal task (full TTY / shell profile),
 * so tools like Expo and Metro behave like a manual run. Resolves when the shell process exits.
 */
export async function runCommandBackground(
  cwd: string,
  command: string,
  onExit: (exitCode: number | undefined) => void,
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.find((f) => {
    const root = f.uri.fsPath;
    return cwd === root || cwd.startsWith(`${root}${path.sep}`);
  });
  const scope = folder ?? vscode.TaskScope.Workspace;

  const taskId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const task = new vscode.Task(
    { type: "rnEasyEmulator", taskId },
    scope,
    "RN Easy Emulator",
    "rn-easy-emulator",
    new vscode.ShellExecution(command, { cwd }),
    [],
  );

  task.presentationOptions = {
    reveal: vscode.TaskRevealKind.Always,
    panel: vscode.TaskPanelKind.Shared,
    focus: true,
    showReuseMessage: false,
    clear: false,
    echo: true,
  };

  let finished = false;
  const finish = (exitCode: number | undefined) => {
    if (finished) {
      return;
    }
    finished = true;
    onExit(exitCode);
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const sub = vscode.tasks.onDidEndTaskProcess((e) => {
        const def = e.execution.task.definition as { type?: string; taskId?: string };
        if (def.type !== "rnEasyEmulator" || def.taskId !== taskId) {
          return;
        }
        sub.dispose();
        finish(e.exitCode);
        resolve();
      });

      vscode.tasks.executeTask(task).then(undefined, (err: unknown) => {
        sub.dispose();
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  } catch (err) {
    finish(undefined);
    throw err instanceof Error ? err : new Error(String(err));
  }
}
