export const CONFIG_SECTION = "rnEasyEmulator";

export const TERMINAL_NAME = "RN Easy Emulator";

export const DEVICE_LIST_REFRESH_MS = 12_000;

export const IOS_BOOT_UI_DELAY_MS = 1200;

export const ANDROID_ADB_WAIT_MS = 180_000;

/** Poll `sys.boot_completed` after adb shows `device` (cold boot can take minutes). */
export const ANDROID_BOOT_COMPLETED_WAIT_MS = 300_000;

/** Poll `adb devices` until serial stays `device` for several consecutive reads (replaces fixed sleep). */
export const ANDROID_ADB_STABILIZE_POLL_MS = 500;
export const ANDROID_ADB_STABILIZE_STREAK = 8;
export const ANDROID_ADB_STABILIZE_TIMEOUT_MS = 120_000;

export const STATUS_BAR_MESSAGE_MS = 3000;

export const STATUS_BAR_COMMAND_MS = 4000;

export const STATUS_BAR_START_EMULATOR_MS = 5000;
