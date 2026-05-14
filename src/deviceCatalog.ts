import * as vscode from "vscode";

import { listAndroidAvds, resolveAndroidSdkHome } from "./androidDevices";
import { CONFIG_SECTION } from "./constants";
import { DeviceTreeProvider } from "./deviceTree";
import { listIosSimulators } from "./iosDevices";
import * as Labels from "./labels";

export async function refreshDeviceCatalog(
  tree: DeviceTreeProvider,
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const sdkOverride = cfg.get<string>("androidSdkHome") ?? "";
  const androidSdk = resolveAndroidSdkHome(sdkOverride);

  let androidError: string | undefined;

  const iosPromise = listIosSimulators().catch((error: Error) => {
    void vscode.window.showWarningMessage(
      `${Labels.Messages.iosListWarningPrefix} ${Labels.Messages.iosListWarningBody(error.message)}`,
    );
    return [];
  });

  const androidPromise = loadAndroidList(androidSdk, (message) => {
    androidError = message;
  });

  const [ios, android] = await Promise.all([iosPromise, androidPromise]);

  tree.setData({ ios, android, androidSdk, androidError });
}

async function loadAndroidList(
  androidSdk: string | undefined,
  onSdkError: (message: string) => void,
): Promise<Awaited<ReturnType<typeof listAndroidAvds>>> {
  if (!androidSdk) {
    onSdkError(Labels.Messages.androidSdkUnset);
    return [];
  }

  try {
    return await listAndroidAvds(androidSdk);
  } catch (error) {
    onSdkError((error as Error).message);
    return [];
  }
}
