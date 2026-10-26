type EnvConfig = Record<string, unknown>;

export function validateEnv(config: EnvConfig): EnvConfig {
  const rawPort = config.PORT;

  if (rawPort === undefined || rawPort === '') {
    return { ...config, PORT: 3000 };
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535');
  }

  return { ...config, PORT: port };
}
