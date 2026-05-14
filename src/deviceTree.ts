import * as vscode from "vscode";

import type { AndroidAvd } from "./androidDevices";
import type { IosSimulator } from "./iosDevices";
import * as Labels from "./labels";

export type DeviceTreeElement =
  | { kind: "platform"; id: "ios" | "android" }
  | { kind: "iosSim"; sim: IosSimulator }
  | { kind: "androidAvd"; sdk: string; avd: AndroidAvd }
  | { kind: "androidHint"; message: string };

export class DeviceTreeProvider
  implements vscode.TreeDataProvider<DeviceTreeElement>
{
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    DeviceTreeElement | undefined | void
  >();

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private iosDevices: IosSimulator[] = [];

  private androidDevices: AndroidAvd[] = [];

  private androidSdkPath: string | undefined;

  private androidLoadError: string | undefined;

  setData(snapshot: {
    ios: IosSimulator[];
    android: AndroidAvd[];
    androidSdk: string | undefined;
    androidError: string | undefined;
  }): void {
    this.iosDevices = snapshot.ios;
    this.androidDevices = snapshot.android;
    this.androidSdkPath = snapshot.androidSdk;
    this.androidLoadError = snapshot.androidError;
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(
    element: DeviceTreeElement
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    switch (element.kind) {
      case "platform":
        return this.createPlatformItem(element.id);
      case "androidHint":
        return this.createHintItem(element.message);
      case "iosSim":
        return this.createIosSimulatorItem(element);
      case "androidAvd":
        return this.createAndroidAvdItem(element);
    }
  }

  getChildren(
    element?: DeviceTreeElement
  ): vscode.ProviderResult<DeviceTreeElement[]> {
    if (!element) {
      return [
        { kind: "platform", id: "ios" },
        { kind: "platform", id: "android" },
      ];
    }

    if (element.kind !== "platform") {
      return [];
    }

    if (element.id === "ios") {
      return this.iosDevices.map((sim) => ({ kind: "iosSim" as const, sim }));
    }

    return this.getAndroidSectionChildren();
  }

  getParent(): vscode.ProviderResult<DeviceTreeElement> {
    return undefined;
  }

  private countRunningIosSimulators(): number {
    return this.iosDevices.filter((simulator) => simulator.state === "Booted")
      .length;
  }

  private countConnectedAndroidDevices(): number {
    return this.androidDevices.filter((device) => device.state === "device")
      .length;
  }

  private createPlatformItem(platform: "ios" | "android"): vscode.TreeItem {
    const running =
      platform === "ios"
        ? this.countRunningIosSimulators()
        : this.countConnectedAndroidDevices();

    const label =
      platform === "ios"
        ? Labels.iosPlatformLabel(running)
        : Labels.androidPlatformLabel(running);

    const item = new vscode.TreeItem(
      label,
      vscode.TreeItemCollapsibleState.Expanded
    );

    item.iconPath = new vscode.ThemeIcon(
      platform === "ios" ? "device-mobile" : "vm"
    );

    item.contextValue = "platform";

    return item;
  }

  private createHintItem(message: string): vscode.TreeItem {
    const item = new vscode.TreeItem(
      message,
      vscode.TreeItemCollapsibleState.None
    );

    item.iconPath = new vscode.ThemeIcon("info");

    return item;
  }

  private createIosSimulatorItem(
    element: Extract<DeviceTreeElement, { kind: "iosSim" }>
  ): vscode.TreeItem {
    const { sim } = element;
    const isBooted = sim.state === "Booted";

    const item = new vscode.TreeItem(
      sim.name,
      vscode.TreeItemCollapsibleState.None
    );

    item.description = isBooted
      ? Labels.IosTree.stateRunning
      : Labels.IosTree.stateOff;

    item.tooltip = Labels.IosTree.tooltipState(
      sim.runtimeLabel,
      sim.udid,
      sim.state
    );

    item.iconPath = new vscode.ThemeIcon("device-mobile");
    item.contextValue = isBooted ? "sim-ios-booted" : "sim-ios-offline";

    item.command = {
      command: "rnEasyEmulator.runOnDevice",
      title: Labels.IosTree.runCommandTitle,
      arguments: [element],
    };

    return item;
  }

  private createAndroidAvdItem(
    element: Extract<DeviceTreeElement, { kind: "androidAvd" }>
  ): vscode.TreeItem {
    const { avd } = element;
    const isOnline = avd.state === "device" && !!avd.adbSerial;

    const item = new vscode.TreeItem(
      avd.avdName,
      vscode.TreeItemCollapsibleState.None
    );

    item.description = isOnline
      ? Labels.AndroidTree.stateConnected
      : Labels.AndroidTree.stateOffline;

    item.tooltip = isOnline
      ? `Serial: ${avd.adbSerial}`
      : Labels.AndroidTree.tooltipOfflineHint;

    item.iconPath = new vscode.ThemeIcon("device-mobile");
    item.contextValue = isOnline ? "sim-android-device" : "sim-android-offline";

    item.command = {
      command: "rnEasyEmulator.runOnDevice",
      title: Labels.AndroidTree.runCommandTitle,
      arguments: [element],
    };

    return item;
  }

  private getAndroidSectionChildren(): DeviceTreeElement[] {
    if (!this.androidSdkPath) {
      const message =
        this.androidLoadError ?? Labels.Hints.androidSdkMissing;

      return [{ kind: "androidHint", message }];
    }

    if (this.androidDevices.length === 0) {
      return [{ kind: "androidHint", message: Labels.Hints.noAvdsFound }];
    }

    return this.androidDevices.map((avd) => ({
      kind: "androidAvd" as const,
      sdk: this.androidSdkPath!,
      avd,
    }));
  }
}
