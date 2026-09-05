import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

function lireEnv(source: NodeJS.ProcessEnv, key: string, fallback = ''): string {
  return source[key] ?? fallback;
}

/** Options TypeORM partagées — Neon (DATABASE_URL) ou Postgres local. */
export function buildTypeOrmOptions(
  config: NodeJS.ProcessEnv,
  entities: Function[],
): PostgresConnectionOptions {
  const databaseUrl = lireEnv(config, 'DATABASE_URL');
  const synchronize = lireEnv(config, 'DB_SYNC', 'true') === 'true';
  const sslEnabled = lireEnv(config, 'DB_SSL', databaseUrl ? 'true' : 'false') === 'true';
  const ssl = sslEnabled ? { rejectUnauthorized: false } : undefined;

  if (databaseUrl) {
    return {
      type: 'postgres',
      url: databaseUrl,
      entities,
      synchronize,
      ssl,
      extra: { max: 10 },
    };
  }

  return {
    type: 'postgres',
    host: lireEnv(config, 'DB_HOST', '127.0.0.1'),
    port: Number(lireEnv(config, 'DB_PORT', '5432')),
    username: lireEnv(config, 'DB_USER', 'postgres'),
    password: lireEnv(config, 'DB_PASSWORD', ''),
    database: lireEnv(config, 'DB_NAME', 'gmao'),
    entities,
    synchronize,
    ssl,
    extra: { max: 10 },
  };
}
