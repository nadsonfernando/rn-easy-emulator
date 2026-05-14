import * as fs from "fs/promises";
import * as path from "path";
import * as vscode from "vscode";

export async function detectReactNativeProject(): Promise<boolean> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    return false;
  }

  try {
    const content = await fs.readFile(path.join(root, "package.json"), "utf8");
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return !!(
      pkg.dependencies?.["react-native"] ??
      pkg.devDependencies?.["react-native"]
    );
  } catch {
    return false;
  }
}
