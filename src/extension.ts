import * as vscode from "vscode";

import {
  DEVICE_LIST_REFRESH_MS,
  STATUS_BAR_MESSAGE_MS,
  STATUS_BAR_START_EMULATOR_MS,
} from "./constants";
import { refreshDeviceCatalog } from "./deviceCatalog";
import { DeviceTreeProvider, DeviceStatus, type DeviceTreeElement } from "./deviceTree";
import {
  getExtensionConfiguration,
  readWorkspaceRoot,
  runAndroidProject,
  runIosProject,
  toggleAndroidPower,
  toggleIosPower,
} from "./deviceRun";
import { detectReactNativeProject } from "./rnDetection";
import * as Labels from "./labels";

function isRunnableDevice(
  element: DeviceTreeElement | undefined,
): element is Extract<
  DeviceTreeElement,
  { kind: "iosSim" } | { kind: "androidAvd" }
> {
  return (
    !!element && element.kind !== "platform" && element.kind !== "androidHint"
  );
}

function resolveSelectedNode(
  explicit: DeviceTreeElement | undefined,
  treeView: vscode.TreeView<DeviceTreeElement>,
): DeviceTreeElement | undefined {
  return explicit ?? (treeView.selection[0] as DeviceTreeElement | undefined);
}

function deviceIdOf(element: Extract<DeviceTreeElement, { kind: "iosSim" } | { kind: "androidAvd" }>): string {
  return element.kind === "iosSim" ? element.sim.udid : element.avd.avdName;
}

async function runPowerToggle(
  element: DeviceTreeElement | undefined,
  treeView: vscode.TreeView<DeviceTreeElement>,
  treeProvider: DeviceTreeProvider,
): Promise<void> {
  const selected = resolveSelectedNode(element, treeView);

  if (!isRunnableDevice(selected)) {
    return;
  }

  const deviceId = deviceIdOf(selected);
  treeProvider.setDeviceStatus(deviceId, DeviceStatus.Launching);

  try {
    if (selected.kind === "iosSim") {
      const wasBooted = selected.sim.state === "Booted";

      await toggleIosPower(selected.sim);

      vscode.window.setStatusBarMessage(
        wasBooted
          ? Labels.Status.iosSimulatorShutDown
          : Labels.Status.startingIosSimulator(selected.sim.name),
        wasBooted ? STATUS_BAR_MESSAGE_MS : STATUS_BAR_START_EMULATOR_MS,
      );
    } else {
      const wasOnline =
        selected.avd.state === "device" && !!selected.avd.adbSerial;

      await toggleAndroidPower(selected.sdk, selected.avd);

      vscode.window.setStatusBarMessage(
        wasOnline
          ? Labels.Status.androidEmulatorStopped
          : Labels.Status.startingAvd(selected.avd.avdName),
        wasOnline ? STATUS_BAR_MESSAGE_MS : STATUS_BAR_START_EMULATOR_MS,
      );
    }

    await refreshDeviceCatalog(treeProvider);
  } catch (error) {
    vscode.window.showErrorMessage((error as Error).message);
  } finally {
    treeProvider.setDeviceStatus(deviceId, DeviceStatus.Idle);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const treeProvider = new DeviceTreeProvider();
  const treeView = vscode.window.createTreeView("rnEasyEmulator.devices", {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });

  // ── RN project detection ──────────────────────────────────────────────────
  let isReactNativeProject = false;

  const updateRnContext = async () => {
    isReactNativeProject = await detectReactNativeProject();
    await vscode.commands.executeCommand(
      "setContext",
      "rnEasyEmulator.isReactNativeProject",
      isReactNativeProject,
    );
  };

  void updateRnContext();

  const pkgWatcher = vscode.workspace.createFileSystemWatcher(
    "**/package.json",
    false,
    false,
    false,
  );

  context.subscriptions.push(
    pkgWatcher,
    pkgWatcher.onDidChange(() => void updateRnContext()),
    pkgWatcher.onDidCreate(() => void updateRnContext()),
    pkgWatcher.onDidDelete(() => void updateRnContext()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => void updateRnContext()),
  );

  // ── Device list ───────────────────────────────────────────────────────────
  const refreshWithProgress = async () => {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: Labels.Progress.refreshingDevices,
      },
      () => refreshDeviceCatalog(treeProvider),
    );
  };

  void refreshDeviceCatalog(treeProvider);

  const refreshTimer = setInterval(
    () => void refreshDeviceCatalog(treeProvider),
    DEVICE_LIST_REFRESH_MS,
  );

  // ── Commands ──────────────────────────────────────────────────────────────
  context.subscriptions.push(
    treeView,

    vscode.commands.registerCommand(
      "rnEasyEmulator.refresh",
      refreshWithProgress,
    ),

    vscode.commands.registerCommand(
      "rnEasyEmulator.runOnDevice",
      async (element?: DeviceTreeElement) => {
        const selected = resolveSelectedNode(element, treeView);

        if (!isRunnableDevice(selected)) {
          vscode.window.showInformationMessage(Labels.Messages.pickSimulator);
          return;
        }

        if (!isReactNativeProject) {
          vscode.window.showInformationMessage(
            Labels.Messages.notReactNativeProject,
          );
          return;
        }

        const workspaceRoot = readWorkspaceRoot();
        if (!workspaceRoot) {
          vscode.window.showErrorMessage(Labels.Messages.openWorkspaceFolder);
          return;
        }

        const configuration = getExtensionConfiguration();
        const deviceId = deviceIdOf(selected);

        treeProvider.setDeviceStatus(deviceId, DeviceStatus.Launching);

        try {
          if (selected.kind === "iosSim") {
            await runIosProject(selected.sim, workspaceRoot, configuration, {
              onCommandStart: () =>
                treeProvider.setDeviceStatus(deviceId, DeviceStatus.Running),
              onCommandExit: (exitCode) => {
                treeProvider.setDeviceStatus(deviceId, DeviceStatus.Idle);
                void refreshDeviceCatalog(treeProvider);
                if (typeof exitCode === "number" && exitCode !== 0) {
                  void vscode.window.showWarningMessage(
                    Labels.Messages.buildFailedWithExitCode(exitCode),
                  );
                }
              },
            });
          } else {
            await runAndroidProject(
              selected.sdk,
              selected.avd,
              workspaceRoot,
              configuration,
              {
                onCommandStart: () =>
                  treeProvider.setDeviceStatus(deviceId, DeviceStatus.Running),
                onCommandExit: (exitCode) => {
                  treeProvider.setDeviceStatus(deviceId, DeviceStatus.Idle);
                  void refreshDeviceCatalog(treeProvider);
                  if (typeof exitCode === "number" && exitCode !== 0) {
                    void vscode.window.showWarningMessage(
                      Labels.Messages.buildFailedWithExitCode(exitCode),
                    );
                  }
                },
              },
            );
          }
        } catch (error) {
          treeProvider.setDeviceStatus(deviceId, DeviceStatus.Idle);
          vscode.window.showErrorMessage((error as Error).message);
        }
      },
    ),

    vscode.commands.registerCommand(
      "rnEasyEmulator.startEmulator",
      async (element?: DeviceTreeElement) => {
        await runPowerToggle(element, treeView, treeProvider);
      },
    ),

    vscode.commands.registerCommand(
      "rnEasyEmulator.stopEmulator",
      async (element?: DeviceTreeElement) => {
        await runPowerToggle(element, treeView, treeProvider);
      },
    ),

    new vscode.Disposable(() => clearInterval(refreshTimer)),
  );
}

export function deactivate(): void {}
