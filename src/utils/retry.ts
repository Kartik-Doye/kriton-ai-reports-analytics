export async function fetchWithRetry(url: string, options?: RequestInit, retries = 5, initialDelay = 1000): Promise<Response> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const response = await fetch(url, options);
      if (response.status === 503 || response.status === 429 || response.status >= 500) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      return response;
    } catch (error: any) {
      attempt++;
      if (attempt >= retries) {
        throw error;
      }
      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.warn(`Fetch failed to ${url}, retrying in ${delay}ms... (Attempt ${attempt}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Fetch failed after retries.");
}
