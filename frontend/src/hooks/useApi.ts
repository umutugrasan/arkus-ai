import { useState, useCallback } from 'react';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(apiFn: (...args: unknown[]) => Promise<T>) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (...args: unknown[]) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiFn(...args);
      setState({ data, loading: false, error: null });
      return data;
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } }; message?: string })
        ?.response?.data?.detail || 'Bir hata oluştu';
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw e;
    }
  }, [apiFn]);

  return { ...state, execute };
}
