import type {
  ResolvedSpannerConnectionConfig,
  SpannerConnectionConfig,
} from './types.js';

const ENV_PROJECT_ID = 'SPANNER_ASSERT_PROJECT_ID';
const ENV_INSTANCE_ID = 'SPANNER_ASSERT_INSTANCE_ID';
const ENV_DATABASE_ID = 'SPANNER_ASSERT_DATABASE_ID';
const ENV_EMULATOR_HOST = 'SPANNER_EMULATOR_HOST';

export class MissingConfigurationError extends Error {
  constructor(field: string) {
    super(`Spanner接続設定の${field}が指定されていません。`);
    this.name = 'MissingConfigurationError';
  }
}

export type ResolveConfigOptions = Partial<SpannerConnectionConfig>;

/**
 * 環境変数と引数からSpannerの接続設定を解決する。
 */
export function resolveConnectionConfig(
  overrides: ResolveConfigOptions = {},
): ResolvedSpannerConnectionConfig {
  const projectId =
    overrides.projectId ?? process.env[ENV_PROJECT_ID] ?? process.env.GOOGLE_CLOUD_PROJECT;
  const instanceId =
    overrides.instanceId ?? process.env[ENV_INSTANCE_ID] ?? process.env.SPANNER_INSTANCE_ID;
  const databaseId =
    overrides.databaseId ?? process.env[ENV_DATABASE_ID] ?? process.env.SPANNER_DATABASE_ID;
  const emulatorHost = overrides.emulatorHost ?? process.env[ENV_EMULATOR_HOST];

  if (!projectId) {
    throw new MissingConfigurationError('projectId');
  }

  if (!instanceId) {
    throw new MissingConfigurationError('instanceId');
  }

  if (!databaseId) {
    throw new MissingConfigurationError('databaseId');
  }

  return {
    projectId,
    instanceId,
    databaseId,
    emulatorHost,
  };
}
