import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import { runBinary } from "./shell";

export type AndroidAvd = {
  avdName: string;
  /** adb serial when running, e.g. emulator-5554 */
  adbSerial?: string;
  state: "device" | "offline" | "unknown";
};

export function resolveAndroidSdkHome(configOverride: string): string | undefined {
  const trimmed = configOverride.trim();
  if (trimmed) {
    return trimmed;
  }
  const fromEnv = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT;
  return fromEnv?.replace(/\/$/, "");
}

function adbPath(sdk: string): string {
  return path.join(sdk, "platform-tools", "adb");
}

function emulatorPath(sdk: string): string {
  return path.join(sdk, "emulator", "emulator");
}

export async function listAvdNames(sdkHome: string): Promise<string[]> {
  const emu = emulatorPath(sdkHome);
  if (!fs.existsSync(emu)) {
    return [];
  }
  const { stdout } = await runBinary(emu, ["-list-avds"]);
  return stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type AdbLine = { serial: string; state: string };

function parseAdbDevices(stdout: string): AdbLine[] {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const out: AdbLine[] = [];
  for (const line of lines) {
    if (line.startsWith("List of devices")) {
      continue;
    }
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      out.push({ serial: parts[0], state: parts[1] });
    }
  }
  return out;
}

async function avdNameForSerial(adb: string, serial: string): Promise<string | undefined> {
  try {
    const { stdout } = await runBinary(adb, ["-s", serial, "emu", "avd", "name"]);
    const name = stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s && s !== "OK")[0];
    return name || undefined;
  } catch {
    return undefined;
  }
}

export async function listAndroidAvds(
  sdkHome: string
): Promise<AndroidAvd[]> {
  const names = await listAvdNames(sdkHome);
  const adb = adbPath(sdkHome);
  if (!fs.existsSync(adb)) {
    return names.map((avdName) => ({ avdName, state: "unknown" as const }));
  }
  let adbLines: AdbLine[] = [];
  try {
    const { stdout } = await runBinary(adb, ["devices"]);
    adbLines = parseAdbDevices(stdout);
  } catch {
    adbLines = [];
  }
  const emulatorSerials = adbLines.filter(
    (l) => l.serial.startsWith("emulator-") && l.state === "device"
  );
  const serialToAvd = new Map<string, string>();
  for (const { serial } of emulatorSerials) {
    const avd = await avdNameForSerial(adb, serial);
    if (avd) {
      serialToAvd.set(avd.trim().toLowerCase(), serial);
    }
  }
  return names.map((avdName) => {
    const serial = serialToAvd.get(avdName.trim().toLowerCase());
    const state: AndroidAvd["state"] = serial ? "device" : "offline";
    return { avdName, adbSerial: serial, state };
  });
}

export function spawnAndroidEmulator(sdkHome: string, avdName: string): void {
  const emu = emulatorPath(sdkHome);
  const child = cp.spawn(emu, ["-avd", avdName], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ANDROID_HOME: sdkHome, ANDROID_SDK_ROOT: sdkHome },
  });
  child.unref();
}

export async function waitForAvdSerial(
  sdkHome: string,
  avdName: string,
  timeoutMs: number
): Promise<string | undefined> {
  const adb = adbPath(sdkHome);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { stdout } = await runBinary(adb, ["devices"]);
      const lines = parseAdbDevices(stdout).filter(
        (l) => l.serial.startsWith("emulator-") && l.state === "device"
      );
      for (const { serial } of lines) {
        const name = await avdNameForSerial(adb, serial);
        if (
          name &&
          name.trim().toLowerCase() === avdName.trim().toLowerCase()
        ) {
          return serial;
        }
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return undefined;
}
