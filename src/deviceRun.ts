import * as path from "path";
import * as vscode from "vscode";

import type { AndroidAvd } from "./androidDevices";
import { spawnAndroidEmulator, waitForAvdSerial } from "./androidDevices";
import {
  ANDROID_ADB_WAIT_MS,
  CONFIG_SECTION,
  IOS_BOOT_UI_DELAY_MS,
  STATUS_BAR_COMMAND_MS,
} from "./constants";
import { interpolateCommand } from "./commandInterpolation";
import {
  bootIosSimulator,
  openSimulatorApp,
  shutdownIosSimulator,
} from "./iosDevices";
import type { IosSimulator } from "./iosDevices";
import * as Labels from "./labels";
import { detectProjectRuntime } from "./projectKind";
import { runBinary } from "./shell";
import { runCommandBackground } from "./processRunner";

interface RunCallbacks {
  onCommandStart?: () => void;
  onCommandExit?: (exitCode: number | undefined) => void;
}

const BARE_IOS = "npx react-native run-ios --udid {{udid}}";
const BARE_ANDROID = "npx react-native run-android --deviceId {{deviceId}}";
const EXPO_IOS = "npx expo run:ios --device {{udid}}";
const EXPO_ANDROID = "npx expo run:android --device {{deviceId}}";

async function resolveDefaultRunCommands(
  workspaceRoot: string,
): Promise<{ ios: string; android: string }> {
  const runtime = await detectProjectRuntime(workspaceRoot);
  if (runtime === "expo") {
    return { ios: EXPO_IOS, android: EXPO_ANDROID };
  }
  return { ios: BARE_IOS, android: BARE_ANDROID };
}

async function iosRunTemplateFromConfiguration(
  configuration: vscode.WorkspaceConfiguration,
  workspaceRoot: string,
): Promise<string> {
  const inspected = configuration.inspect<string>("iosRunCommand");
  const override =
    inspected?.workspaceFolderValue ??
    inspected?.workspaceValue ??
    inspected?.globalValue;
  if (typeof override === "string" && override.trim() !== "") {
    return override.trim();
  }
  return (await resolveDefaultRunCommands(workspaceRoot)).ios;
}

async function androidRunTemplateFromConfiguration(
  configuration: vscode.WorkspaceConfiguration,
  workspaceRoot: string,
): Promise<string> {
  const inspected = configuration.inspect<string>("androidRunCommand");
  const override =
    inspected?.workspaceFolderValue ??
    inspected?.workspaceValue ??
    inspected?.globalValue;
  if (typeof override === "string" && override.trim() !== "") {
    return override.trim();
  }
  return (await resolveDefaultRunCommands(workspaceRoot)).android;
}

export async function runIosProject(
  sim: IosSimulator,
  workspaceRoot: string,
  configuration: vscode.WorkspaceConfiguration,
  callbacks: RunCallbacks = {},
): Promise<void> {
  if (sim.state !== "Booted") {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: Labels.Progress.bootingIos(sim.name),
      },
      async () => {
        await bootIosSimulator(sim.udid);
        await openSimulatorApp();
        await delay(IOS_BOOT_UI_DELAY_MS);
      },
    );
  }

  const template = await iosRunTemplateFromConfiguration(
    configuration,
    workspaceRoot,
  );

  const command = interpolateCommand(template, {
    name: sim.name,
    udid: sim.udid,
    runtime: sim.runtimeLabel,
  });

  callbacks.onCommandStart?.();

  vscode.window.setStatusBarMessage(
    Labels.Status.runningCommand(command),
    STATUS_BAR_COMMAND_MS,
  );

  try {
    await runCommandBackground(workspaceRoot, command, (exitCode) => {
      callbacks.onCommandExit?.(exitCode);
    });
  } catch (err) {
    throw err instanceof Error ? err : new Error(Labels.Messages.runTaskFailed);
  }
}

export async function runAndroidProject(
  sdkRoot: string,
  avd: AndroidAvd,
  workspaceRoot: string,
  configuration: vscode.WorkspaceConfiguration,
  callbacks: RunCallbacks = {},
): Promise<void> {
  let deviceId = avd.adbSerial ?? "";

  if (!deviceId) {
    spawnAndroidEmulator(sdkRoot, avd.avdName);

    const serial = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: Labels.Progress.waitingForAdb(avd.avdName),
      },
      () => waitForAvdSerial(sdkRoot, avd.avdName, ANDROID_ADB_WAIT_MS),
    );

    if (!serial) {
      throw new Error(Labels.Messages.emulatorAdbTimeout);
    }

    deviceId = serial;
  }

  const template = await androidRunTemplateFromConfiguration(
    configuration,
    workspaceRoot,
  );

  const command = interpolateCommand(template, {
    deviceId,
    avd: avd.avdName,
  });

  callbacks.onCommandStart?.();

  vscode.window.setStatusBarMessage(
    Labels.Status.runningCommand(command),
    STATUS_BAR_COMMAND_MS,
  );

  try {
    await runCommandBackground(workspaceRoot, command, (exitCode) => {
      callbacks.onCommandExit?.(exitCode);
    });
  } catch (err) {
    throw err instanceof Error ? err : new Error(Labels.Messages.runTaskFailed);
  }
}

export async function toggleIosPower(sim: IosSimulator): Promise<void> {
  if (sim.state === "Booted") {
    await shutdownIosSimulator(sim.udid);
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: Labels.Progress.poweringOnIos(sim.name),
    },
    async () => {
      await bootIosSimulator(sim.udid);
      await openSimulatorApp();
    },
  );
}

export async function toggleAndroidPower(
  sdkRoot: string,
  avd: AndroidAvd,
): Promise<void> {
  if (avd.state === "device" && avd.adbSerial) {
    const adbExecutable = path.join(sdkRoot, "platform-tools", "adb");
    await runBinary(adbExecutable, ["-s", avd.adbSerial, "emu", "kill"]);
    return;
  }

  spawnAndroidEmulator(sdkRoot, avd.avdName);
}

export function readWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function getExtensionConfiguration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(CONFIG_SECTION);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
