// Axios hatasini insan-okunur mesaja cevirir.
import { AxiosError } from 'axios';

export function getErrorMessage(error: unknown, fallback = 'Beklenmedik bir hata olustu'): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data;
    if (data && typeof data === 'object') {
      if (typeof (data as { detail?: unknown }).detail === 'string') {
        return (data as { detail: string }).detail;
      }
      // Pydantic validation: detail array of errors
      if (Array.isArray((data as { detail?: unknown }).detail)) {
        const arr = (data as { detail: Array<{ msg?: string; loc?: unknown[] }> }).detail;
        return arr
          .map((e) => {
            const loc = Array.isArray(e.loc) ? e.loc.slice(-1)[0] : '';
            return `${loc ? loc + ': ' : ''}${e.msg || ''}`;
          })
          .filter(Boolean)
          .join('; ');
      }
    }
    if (error.response?.status === 429) {
      return 'Cok hizli istek attiniz, lutfen 1 dakika sonra tekrar deneyin.';
    }
    if (error.response?.status === 401) {
      return 'Oturumunuz suresi dolmus, lutfen yeniden giris yapin.';
    }
    if (error.response?.status === 503 || error.code === 'ECONNREFUSED') {
      return 'Sunucuya ulasilamiyor. Lutfen daha sonra tekrar deneyin.';
    }
    return error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
