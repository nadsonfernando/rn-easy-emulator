# RN Easy Emulator

A [Visual Studio Code](https://code.visualstudio.com/) extension (and compatible editors such as Cursor) that lists **iOS** simulators and **Android** emulators and runs your **React Native** project on the device you choose.

## Requirements

- A React Native project opened as a **workspace folder** (File → Open Folder).
- **macOS** with Xcode and `xcrun simctl` for iOS.
- **Android SDK** with `emulator` and `adb` on your `PATH` (or `ANDROID_HOME` / `ANDROID_SDK_ROOT` set).

## Installation

1. Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Search for **RN Easy Emulator** and install.

To install from a `.vsix` manually: **Extensions** → **⋯** → **Install from VSIX…**.

## Usage

1. Open your React Native app’s root folder in VS Code.
2. In the **Activity Bar** (icons on the left), click **RN Emulator** (phone icon).
3. In the **Simulators** view you’ll see **iOS** and **Android** with available devices.
4. For each simulator/emulator:
   - **Play** — runs the project on that device (or boots then runs if it is off). If you do not set a custom command, the extension picks **Expo** vs **bare** from `package.json`: iOS uses `expo run:ios` or `react-native run-ios` with the simulator id; Android always uses `react-native run-android` with the ADB serial (`{{deviceId}}`).
   - **Restart** (while the device is running) — stops the current build task for that device and starts a fresh run.
   - **Power** — boots or shuts down the iOS simulator or Android AVD.
5. The **Refresh** button in the view title bar reloads the list.

If nothing is selected and you run **Run project on this emulator** from the Command Palette, the extension asks you to pick an item in the tree.

## Settings

In **Settings**, search for **RN Easy Emulator** or edit `settings.json`:

| Key | Description |
| --- | --- |
| `rnEasyEmulator.iosRunCommand` | Optional override. When unset: Expo → `npx expo run:ios --device {{udid}}`; bare → `npx react-native run-ios --udid {{udid}}`. |
| `rnEasyEmulator.androidRunCommand` | Optional override. When unset, Expo and bare both use `npx react-native run-android --deviceId {{deviceId}}` (ADB serial). |
| `rnEasyEmulator.androidSdkHome` | Android SDK root. When empty, `ANDROID_HOME` / `ANDROID_SDK_ROOT` is used. |
| `rnEasyEmulator.shellPath` | Shell for commands (e.g. `/bin/zsh`). When empty, the system default applies. |

**Example** (override iOS only, e.g. custom script):

```json
"rnEasyEmulator.iosRunCommand": "yarn ios -- --device {{udid}}"
```

## License

This project is licensed under the [MIT License](LICENSE).
