import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function AddTransactionPlaceholder() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/(tabs)/home");
  }, [router]);

  return null;
}
