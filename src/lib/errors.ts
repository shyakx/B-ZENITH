export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
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
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: unknown): ActionResult<never> {
  return { ok: false, error: toErrorMessage(error) };
}
