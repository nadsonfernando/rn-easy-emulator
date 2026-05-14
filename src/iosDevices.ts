import { runBinary, runShellCommand } from "./shell";

export type IosSimulator = {
  udid: string;
  name: string;
  runtimeLabel: string;
  state: "Booted" | "Shutdown" | string;
  isAvailable: boolean;
};

type SimctlDevicesJson = {
  devices: Record<
    string,
    Array<{
      state: string;
      isAvailable?: boolean;
      name: string;
      udid: string;
    }>
  >;
};

function runtimeShortLabel(runtimeKey: string): string {
  const m = runtimeKey.match(/iOS-([\d-]+)/i);
  if (m) {
    return `iOS ${m[1].replace(/-/g, ".")}`;
  }
  const m2 = runtimeKey.match(/([\w.+-]+)$/);
  return m2 ? m2[1] : runtimeKey;
}

export async function listIosSimulators(): Promise<IosSimulator[]> {
  const { stdout } = await runBinary("xcrun", [
    "simctl",
    "list",
    "devices",
    "-j",
  ]);
  const parsed = JSON.parse(stdout) as SimctlDevicesJson;
  const out: IosSimulator[] = [];
  for (const [runtimeKey, list] of Object.entries(parsed.devices ?? {})) {
    if (!Array.isArray(list)) {
      continue;
    }
    const runtimeLabel = runtimeShortLabel(runtimeKey);
    for (const d of list) {
      if (d.isAvailable === false) {
        continue;
      }
      out.push({
        udid: d.udid,
        name: d.name,
        runtimeLabel,
        state: d.state,
        isAvailable: true,
      });
    }
  }
  out.sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      a.runtimeLabel.localeCompare(b.runtimeLabel),
  );
  return out;
}

export async function bootIosSimulator(udid: string): Promise<void> {
  await runBinary("xcrun", ["simctl", "boot", udid]);
}

export async function shutdownIosSimulator(udid: string): Promise<void> {
  await runBinary("xcrun", ["simctl", "shutdown", udid]);
}

export async function openSimulatorApp(): Promise<void> {
  await runShellCommand("open -a Simulator");
}
