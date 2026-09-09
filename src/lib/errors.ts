export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type SimilarNameMatch = {
  id: string;
  name: string;
  kind: "exact" | "near";
};

/** Soft warning for product/category create — manager must confirm. */
export class SimilarNameError extends AppError {
  constructor(
    message: string,
    readonly similar: SimilarNameMatch[],
  ) {
    super(message, "SIMILAR_NAME");
    this.name = "SimilarNameError";
  }
}

export function toErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    const message = error.trim();
    if (message) return message;
  }
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) return message;
  }
  return "Something went wrong.";
}

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; similar?: SimilarNameMatch[] };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: unknown): ActionResult<never> {
  if (error instanceof SimilarNameError) {
    return { ok: false, error: error.message, similar: error.similar };
  }
  return { ok: false, error: toErrorMessage(error) };
}
