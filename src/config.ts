import type { SpannerConnectionConfig } from "./types.ts";

export class MissingConfigurationError extends Error {
  constructor(field: string) {
    super(`Spanner connection setting ${field} is not provided.`);
    this.name = "MissingConfigurationError";
  }
}

/**
 * Resolve Cloud Spanner connection settings from explicit configuration.
 */
export function resolveConnectionConfig(
  config: SpannerConnectionConfig
): SpannerConnectionConfig {
  const { projectId, instanceId, databaseId, emulatorHost } = config;

  if (!projectId) {
    throw new MissingConfigurationError("projectId");
  }

  if (!instanceId) {
    throw new MissingConfigurationError("instanceId");
  }

  if (!databaseId) {
    throw new MissingConfigurationError("databaseId");
  }

  return {
    projectId,
    instanceId,
    databaseId,
    emulatorHost,
  };
}
