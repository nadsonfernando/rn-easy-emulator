import * as vscode from "vscode";

import {
  DEVICE_LIST_REFRESH_MS,
  STATUS_BAR_MESSAGE_MS,
  STATUS_BAR_START_EMULATOR_MS,
} from "./constants";
import { refreshDeviceCatalog } from "./deviceCatalog";
import { DeviceTreeProvider, type DeviceTreeElement } from "./deviceTree";
import {
  getExtensionConfiguration,
  readWorkspaceRoot,
  runAndroidProject,
  runIosProject,
  toggleAndroidPower,
  toggleIosPower,
} from "./deviceRun";
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

export function activate(context: vscode.ExtensionContext): void {
  const treeProvider = new DeviceTreeProvider();
  const treeView = vscode.window.createTreeView("rnEasyEmulator.devices", {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });

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

        const workspaceRoot = readWorkspaceRoot();

        if (!workspaceRoot) {
          vscode.window.showErrorMessage(Labels.Messages.openWorkspaceFolder);
          return;
        }

        const configuration = getExtensionConfiguration();

        try {
          if (selected.kind === "iosSim") {
            await runIosProject(selected.sim, workspaceRoot, configuration);
          } else {
            await runAndroidProject(
              selected.sdk,
              selected.avd,
              workspaceRoot,
              configuration,
            );
          }
        } catch (error) {
          vscode.window.showErrorMessage((error as Error).message);
        }
      },
    ),

    vscode.commands.registerCommand(
      "rnEasyEmulator.togglePower",
      async (element?: DeviceTreeElement) => {
        const selected = resolveSelectedNode(element, treeView);

        if (!isRunnableDevice(selected)) {
          return;
        }

        try {
          if (selected.kind === "iosSim") {
            const wasBooted = selected.sim.state === "Booted";

            await toggleIosPower(selected.sim);

            const statusText = wasBooted
              ? Labels.Status.iosSimulatorShutDown
              : Labels.Status.startingIosSimulator(selected.sim.name);

            vscode.window.setStatusBarMessage(
              statusText,
              wasBooted ? STATUS_BAR_MESSAGE_MS : STATUS_BAR_START_EMULATOR_MS,
            );
          } else {
            const wasOnline =
              selected.avd.state === "device" && !!selected.avd.adbSerial;

            await toggleAndroidPower(selected.sdk, selected.avd);

            const statusText = wasOnline
              ? Labels.Status.androidEmulatorStopped
              : Labels.Status.startingAvd(selected.avd.avdName);

            vscode.window.setStatusBarMessage(
              statusText,
              wasOnline ? STATUS_BAR_MESSAGE_MS : STATUS_BAR_START_EMULATOR_MS,
            );
          }

          await refreshDeviceCatalog(treeProvider);
        } catch (error) {
          vscode.window.showErrorMessage((error as Error).message);
        }
      },
    ),

    new vscode.Disposable(() => clearInterval(refreshTimer)),
  );
}

export function deactivate(): void {}
