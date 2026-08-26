export const GlobalWorkerOptions = { workerSrc: "" };

export function getDocument(): { promise: Promise<never>; destroy: () => Promise<void> } {
  return {
    promise: Promise.reject(new Error("PDF processing is unavailable")),
    destroy: async () => undefined,
  };
}
