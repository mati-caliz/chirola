import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { z } from "zod";
import { PushPlatform, hasText } from "@chirola/shared";
import { registerPushToken, removePushToken } from "./resources";
import { getPreference, preferenceKeys, removePreference, setPreference } from "./storage";

const ANDROID_CHANNEL_ID = "default";
const ANDROID_CHANNEL_NAME = "Avisos de ARCA";
const easConfigSchema = z.object({ projectId: z.string().min(1) });
const easExtraSchema = z.object({ eas: easConfigSchema });

function easProjectId(): string | null {
  const easConfig: unknown = Constants.easConfig;
  const parsedEasConfig = easConfigSchema.safeParse(easConfig);
  if (parsedEasConfig.success) {
    return parsedEasConfig.data.projectId;
  }
  const parsed = easExtraSchema.safeParse(Constants.expoConfig?.extra);
  return parsed.success ? parsed.data.eas.projectId : null;
}

async function hasPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === Notifications.PermissionStatus.GRANTED) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === Notifications.PermissionStatus.GRANTED;
}

export async function registerForPushNotifications(): Promise<void> {
  const projectId = easProjectId();
  if (!Device.isDevice || projectId === null || !(await hasPermission())) {
    return;
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: ANDROID_CHANNEL_NAME,
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerPushToken({
    token,
    platform: Platform.OS === "ios" ? PushPlatform.IOS : PushPlatform.ANDROID,
  });
  await setPreference(preferenceKeys.pushToken, token);
}

export async function unregisterPushNotifications(): Promise<void> {
  const token = await getPreference(preferenceKeys.pushToken);
  if (!hasText(token)) {
    return;
  }
  try {
    await removePushToken(token);
  } finally {
    await removePreference(preferenceKeys.pushToken);
  }
}
