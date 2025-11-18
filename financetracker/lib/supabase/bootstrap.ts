import { useEffect } from "react";

import { useFinanceStore } from "../store";
import { fetchFinanceSnapshot } from "./storage";

export const useSupabaseBootstrap = () => {
  const hydrate = useFinanceStore((state) => state.hydrateFromRemote);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        const snapshot = await fetchFinanceSnapshot();
        if (snapshot && isMounted) {
          hydrate(snapshot);
        }
      } catch (error) {
        console.warn("Unable to hydrate finance store from Supabase", error);
      }
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [hydrate]);
};
