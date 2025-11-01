import { MissingConfigurationError } from "./errors.ts";
import type { SpannerConnectionConfig } from "./types.ts";

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

  if (!emulatorHost) {
    throw new MissingConfigurationError(
      "emulatorHost (this library only supports Cloud Spanner emulator)"
    );
  }

  return {
    projectId,
    instanceId,
    databaseId,
    emulatorHost,
  };
}
