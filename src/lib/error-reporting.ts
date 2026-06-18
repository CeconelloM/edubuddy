type ErrorSeverity = "error" | "warning" | "info";

type ErrorContext = {
  boundary?: string;
  route?: string;
  [key: string]: unknown;
};

export function reportError(
  error: unknown,
  context: ErrorContext = {},
  severity: ErrorSeverity = "error",
) {
  if (typeof window !== "undefined") {
    context.route ??= window.location.pathname;
  }

  const method = severity === "error" ? console.error : severity === "warning" ? console.warn : console.info;
  method("[EduBuddy]", error, context);
}
