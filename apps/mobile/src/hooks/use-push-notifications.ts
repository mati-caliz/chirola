import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { z } from "zod";
import { registerForPushNotifications } from "@/lib/push-notifications";
import { hasText } from "@chirola/shared";

const notificationDataSchema = z.object({ voucherId: z.string().optional() });

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
});

export function usePushNotifications(): void {
  const router = useRouter();

  useEffect(() => {
    registerForPushNotifications().catch(() => undefined);
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = notificationDataSchema.safeParse(response.notification.request.content.data);
      if (data.success && hasText(data.data.voucherId)) {
        router.push(`/(app)/vouchers/${data.data.voucherId}`);
        return;
      }
      router.push("/(app)/(tabs)/comprobantes");
    });
    return () => {
      subscription.remove();
    };
  }, [router]);
}
