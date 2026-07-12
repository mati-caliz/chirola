import { Redirect } from 'expo-router';

/** El guard del layout raíz decide login vs. app; acá arrancamos hacia la app. */
export default function Index() {
  return <Redirect href="/(app)/emisores" />;
}
