import * as fs from "fs/promises";
import * as path from "path";

/** Managed Expo app (uses expo package). */
export type ProjectRuntime = "expo" | "bare";

/**
 * `expo` when the workspace `package.json` lists `expo` as a dependency.
 * Otherwise `bare` (plain React Native / other).
 */
export async function detectProjectRuntime(
  workspaceRoot: string,
): Promise<ProjectRuntime> {
  try {
    const raw = await fs.readFile(
      path.join(workspaceRoot, "package.json"),
      "utf8",
    );
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    if (pkg.dependencies?.expo || pkg.devDependencies?.expo) {
      return "expo";
    }
  } catch {
    // ignore
  }
  return "bare";
}
