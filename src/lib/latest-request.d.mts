export function createLatestRequest(): {
  begin(): { signal: AbortSignal; isCurrent(): boolean };
  cancel(): void;
};
