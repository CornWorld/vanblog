// Pack-side schema bundle for moments.
//
// This is compiled by scripts/pack-schema-build.mjs into schema.js (CJS) and
// consumed by vault/internal/validation.PackSource at runtime. It deliberately
// only exports the models owned by this Pack; core models are built separately
// into runtime/core-schema/models.js.
import { MomentSchema } from '@vanblog/sdk';

export const models = {
  moments: MomentSchema,
};
