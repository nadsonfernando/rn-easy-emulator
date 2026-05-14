import * as path from "path";
import * as vscode from "vscode";

import type { AndroidAvd } from "./androidDevices";
import {
  spawnAndroidEmulator,
  waitForAvdSerial,
} from "./androidDevices";
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
import { runBinary } from "./shell";
import { runCommandBackground } from "./processRunner";

interface RunCallbacks {
  onCommandStart?: () => void;
  onCommandExit?: () => void;
}

const DEFAULT_IOS_RUN =
  'npx react-native run-ios --udid "{{udid}}"';

const DEFAULT_ANDROID_RUN =
  'npx react-native run-android --deviceId "{{deviceId}}"';

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

  const template =
    configuration.get<string>("iosRunCommand") ?? DEFAULT_IOS_RUN;

  const command = interpolateCommand(template, {
    name: sim.name,
    udid: sim.udid,
    runtime: sim.runtimeLabel,
  });

  callbacks.onCommandStart?.();

  runCommandBackground(workspaceRoot, command, () => {
    callbacks.onCommandExit?.();
  });

  vscode.window.setStatusBarMessage(
    Labels.Status.runningCommand(command),
    STATUS_BAR_COMMAND_MS,
  );
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

  const template =
    configuration.get<string>("androidRunCommand") ?? DEFAULT_ANDROID_RUN;

  const command = interpolateCommand(template, {
    deviceId,
    avd: avd.avdName,
  });

  callbacks.onCommandStart?.();

  runCommandBackground(workspaceRoot, command, () => {
    callbacks.onCommandExit?.();
  });

  vscode.window.setStatusBarMessage(
    Labels.Status.runningCommand(command),
    STATUS_BAR_COMMAND_MS,
  );
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
