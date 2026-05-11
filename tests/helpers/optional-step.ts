type OptionalStepOptions = {
  label?: string;
  warn?: boolean;
};

function formatOptionalError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runOptionalStep<T>(
  step: () => Promise<T>,
  options: OptionalStepOptions = {},
): Promise<T | undefined> {
  try {
    return await step();
  } catch (error: unknown) {
    if (options.warn) {
      console.warn(
        `[optional-step] ${options.label ?? "unnamed"}: ${formatOptionalError(error)}`,
      );
    }
    return undefined;
  }
}
