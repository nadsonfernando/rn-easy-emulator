import * as fs from "fs/promises";
import * as path from "path";

/** Managed Expo app (uses expo package or Expo config). */
export type ProjectRuntime = "expo" | "bare";

/**
 * `expo` when `package.json` lists `expo`, or `app.json` contains an `expo` config object.
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
      peerDependencies?: Record<string, string>;
    };
    if (
      pkg.dependencies?.expo ||
      pkg.devDependencies?.expo ||
      pkg.peerDependencies?.expo
    ) {
      return "expo";
    }
  } catch {
    // ignore
  }

  try {
    const appRaw = await fs.readFile(
      path.join(workspaceRoot, "app.json"),
      "utf8",
    );
    const app = JSON.parse(appRaw) as { expo?: unknown };
    if (app.expo != null && typeof app.expo === "object") {
      return "expo";
    }
  } catch {
    // ignore
  }

  return "bare";
}
