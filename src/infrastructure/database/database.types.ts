import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type DatabaseTransaction = Parameters<
	Parameters<NodePgDatabase['transaction']>[0]
>[0];

export type DatabaseExecutor = NodePgDatabase | DatabaseTransaction;