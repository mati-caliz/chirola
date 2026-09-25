import { Redirect } from "expo-router";
import type { ReactNode } from "react";

export default function Index(): ReactNode {
  return <Redirect href="/(app)/(tabs)" />;
}
