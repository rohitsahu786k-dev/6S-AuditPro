import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * An administrator's override of what a role may do. One document per role, keyed
 * by the role name itself.
 *
 * A role with no document here falls back to the defaults in `lib/roles.ts`, so an
 * empty collection behaves exactly like the hardcoded table did. That fallback is
 * what makes this safe to deploy: nothing changes until somebody saves a change.
 */
const RoleConfigSchema = new Schema({
  _id: { type: String, required: true },
  permissions: [{ type: String }],
  routes: [{ type: String }],
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  updatedByName: { type: String }
}, { timestamps: true, versionKey: false });

export type RoleConfigDocument = InferSchemaType<typeof RoleConfigSchema>;
const RoleConfig = (mongoose.models.RoleConfig as Model<RoleConfigDocument>) || mongoose.model<RoleConfigDocument>("RoleConfig", RoleConfigSchema);
export default RoleConfig;
