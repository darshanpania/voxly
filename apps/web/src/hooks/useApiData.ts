import { useCallback, useEffect, useState } from "react";

interface ApiDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useApiData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
): ApiDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  return { data, loading, error, retry };
}
