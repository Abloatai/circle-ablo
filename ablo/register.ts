import type { schema } from './schema';

declare module '@abloatai/ablo' {
   interface Register {
      Schema: typeof schema;
   }
}

export {};
