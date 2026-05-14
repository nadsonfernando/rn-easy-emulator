import * as path from "path";
import * as vscode from "vscode";

const activeByDevice = new Map<string, vscode.TaskExecution>();

/**
 * Stops the RN/Expo build task for this device (if any) and waits until it is gone.
 */
export async function terminateRunForDevice(deviceKey: string): Promise<void> {
  const execution = activeByDevice.get(deviceKey);
  if (!execution) {
    return;
  }
  execution.terminate();
  const deadline = Date.now() + 20_000;
  while (activeByDevice.has(deviceKey) && Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, 100));
  }
}

/**
 * Runs the build command in a real integrated-terminal task (full TTY / shell profile),
 * so tools like Expo and Metro behave like a manual run. Resolves when the shell process exits.
 * If a task is already running for `deviceKey`, it is terminated first.
 */
export async function runCommandBackground(
  cwd: string,
  command: string,
  deviceKey: string,
  onExit: (exitCode: number | undefined) => void,
): Promise<void> {
  await terminateRunForDevice(deviceKey);

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
    activeByDevice.delete(deviceKey);
    onExit(exitCode);
  };

  let execution: vscode.TaskExecution;
  try {
    execution = await vscode.tasks.executeTask(task);
  } catch (err) {
    finish(undefined);
    throw err instanceof Error ? err : new Error(String(err));
  }

  activeByDevice.set(deviceKey, execution);

  try {
    await new Promise<void>((resolve, reject) => {
      const sub = vscode.tasks.onDidEndTaskProcess((e) => {
        const def = e.execution.task.definition as {
          type?: string;
          taskId?: string;
        };
        if (def.type !== "rnEasyEmulator" || def.taskId !== taskId) {
          return;
        }
        if (e.execution !== execution) {
          return;
        }
        sub.dispose();
        finish(e.exitCode);
        resolve();
      });
    });
  } catch (err) {
    activeByDevice.delete(deviceKey);
    finish(undefined);
    throw err instanceof Error ? err : new Error(String(err));
  }
}
