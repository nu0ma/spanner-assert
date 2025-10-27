import { diff } from "jest-diff";
import { colors } from "consola/utils";

function formatValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

function formatDetails(details: Record<string, unknown>): string {
  const lines: string[] = [];

  if ("expected" in details && "actual" in details) {
    const diffResult = diff(details.expected, details.actual, {
      aAnnotation: "Expected",
      bAnnotation: "Actual",
      aColor: colors.green,
      bColor: colors.red,
      contextLines: 3,
      expand: false,
    });

    if (
      diffResult &&
      diffResult !== "Compared values have no visual difference."
    ) {
      lines.push(diffResult);
    } else {
      lines.push(`  ${colors.green("Expected:")} ${formatValue(details.expected)}`);
      lines.push(`  ${colors.red("Actual:  ")} ${formatValue(details.actual)}`);
    }

    for (const [key, value] of Object.entries(details)) {
      if (key !== "expected" && key !== "actual") {
        lines.push(`  ${key}: ${formatValue(value)}`);
      }
    }
  } else if ("columns" in details) {
    lines.push(`  ${colors.cyan("Expected columns:")}`);
    const columns = details.columns as Record<string, unknown>;
    for (const [column, value] of Object.entries(columns)) {
      lines.push(`    ${colors.bold(column)}: ${formatValue(value)}`);
    }
  } else {
    // Default formatting
    for (const [key, value] of Object.entries(details)) {
      lines.push(`  ${colors.dim(key + ":")} ${formatValue(value)}`);
    }
  }

  return lines.join("\n");
}

export class SpannerAssertionError extends Error {
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    let fullMessage = colors.red(colors.bold(message));
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
