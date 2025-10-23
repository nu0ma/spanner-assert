import pc from "picocolors";

function formatValue(value: unknown): string {
  if (value === null) {
    return pc.gray("null");
  }
  if (value === undefined) {
    return pc.gray("undefined");
  }
  if (typeof value === "string") {
    return pc.green(`"${value}"`);
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return pc.yellow(String(value));
}

function formatDetails(details: Record<string, unknown>): string {
  const lines: string[] = [];

  if ("expected" in details && "actual" in details) {
    lines.push(
      `  ${pc.cyan("Expected:")} ${pc.cyan(formatValue(details.expected))}`
    );
    lines.push(
      `  ${pc.red("Actual:  ")} ${pc.red(formatValue(details.actual))}`
    );

    // Add other details except expected/actual
    for (const [key, value] of Object.entries(details)) {
      if (key !== "expected" && key !== "actual") {
        lines.push(`  ${pc.dim(key + ":")} ${formatValue(value)}`);
      }
    }
  } else if ("columns" in details) {
    lines.push(`  ${pc.cyan("Expected columns:")}`);
    const columns = details.columns as Record<string, unknown>;
    for (const [column, value] of Object.entries(columns)) {
      lines.push(`    ${pc.bold(column)}: ${formatValue(value)}`);
    }
  } else {
    // Default formatting
    for (const [key, value] of Object.entries(details)) {
      lines.push(`  ${pc.dim(key + ":")} ${formatValue(value)}`);
    }
  }

  return lines.join("\n");
}

export class SpannerAssertionError extends Error {
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    let fullMessage = pc.red(pc.bold(message));
    if (details) {
      fullMessage += "\n" + formatDetails(details);
    }
    super(fullMessage);
    this.name = "SpannerAssertionError";
    this.details = details;
  }
}

export class InvalidExpectationFileError extends Error {
  constructor(message: string) {
    super(`Expectation file format is invalid: ${message}`);
    this.name = "InvalidExpectationFileError";
  }
}
