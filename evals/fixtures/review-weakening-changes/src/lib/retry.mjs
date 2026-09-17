export async function retry(fn, { attempts = 3 } = {}) {
  let lastError;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn(i);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
