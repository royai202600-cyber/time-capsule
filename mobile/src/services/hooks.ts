import { useCallback, useEffect, useState } from "react";
import { capsules, friendships, places, profiles, vessels } from "./data";
export function useData<T>(
  load: () => PromiseLike<{
    data: T | null;
    error: { message: string } | null;
  }>,
  deps: unknown[],
) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await load();
      setData(r.data);
      setError(r.error?.message ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, deps);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, error, loading, refresh };
}
export const useCapsules = (id: string, side: "inbox" | "sent") =>
  useData(
    () => (side === "inbox" ? capsules.inbox(id) : capsules.sent(id)),
    [id, side],
  );
export const useProfile = (id: string) => useData(() => profiles.get(id), [id]);
export const useFriends = (id: string) =>
  useData(() => friendships.list(id), [id]);
export const usePlaces = () => useData(() => places.list(), []);
export const useVessels = () => useData(() => vessels.list(), []);
export const useOwnedVessels = (id: string) =>
  useData(() => id ? vessels.owned(id) : Promise.resolve({ data: [], error: null }), [id]);
export const useVesselStock = () => useData(() => vessels.stock(), []);
