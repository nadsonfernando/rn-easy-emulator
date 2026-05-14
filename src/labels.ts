/** User-visible copy (English only). */

export function iosPlatformLabel(runningCount: number): string {
  return `iOS (${runningCount} running)`;
}

export function androidPlatformLabel(connectedCount: number): string {
  const suffix = connectedCount === 1 ? "" : "s";
  return `Android (${connectedCount} connected${suffix})`;
}

export const Power = {
  startEmulator: "Start emulator",
  stopEmulator: "Stop emulator",
} as const;

export const IosTree = {
  stateRunning: "Running",
  stateOff: "Off",
  runCommandTitle: "Run project",
  tooltipState: (runtime: string, udid: string, state: string) =>
    `${runtime}\nUDID: ${udid}\nState: ${state}`,
} as const;

export const AndroidTree = {
  stateConnected: "Connected",
  stateOffline: "AVD offline",
  runCommandTitle: "Run project",
  tooltipOfflineHint:
    "Start the emulator with the power action first, or run the project to boot it automatically.",
} as const;

export const Hints = {
  androidSdkMissing:
    "Set ANDROID_HOME or the rnEasyEmulator.androidSdkHome setting.",
  noAvdsFound: "No AVDs found (emulator -list-avds).",
} as const;

export const Progress = {
  refreshingDevices: "Refreshing devices…",
  bootingIos: (name: string) => `Booting ${name}…`,
  poweringOnIos: (name: string) => `Starting ${name}…`,
  waitingForAdb: (avdName: string) => `Waiting for ${avdName} on adb…`,
} as const;

export const Messages = {
  pickSimulator: "Select a simulator in the list (iOS or Android).",
  openWorkspaceFolder: "Open a workspace folder first.",
  notReactNativeProject:
    "This does not appear to be a React Native project. The run command is only available in projects that have react-native as a dependency.",
  iosListWarningPrefix: "iOS:",
  iosListWarningBody: (detail: string) =>
    `Could not list simulators (${detail}).`,
  androidSdkUnset: "ANDROID_HOME is not set.",
  emulatorAdbTimeout:
    "The emulator did not show up on adb in time. Try again after it finishes booting.",
} as const;

export const Status = {
  iosSimulatorShutDown: "iOS simulator shut down.",
  androidEmulatorStopped: "Android emulator stopped.",
  startingAvd: (name: string) => `Starting AVD ${name}…`,
  startingIosSimulator: (name: string) => `Starting ${name}…`,
  runningCommand: (cmd: string) => `Running: ${cmd}`,
} as const;
