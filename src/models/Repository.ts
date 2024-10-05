import { Schema, model, Document } from "mongoose";

interface IRepository extends Document {
  fullName: string;
  users: string[];
  lastCommitSha: string;
  addedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RepositorySchema = new Schema<IRepository>(
  {
    fullName: { type: String, required: true, unique: true },
    users: [{ type: String, required: true }],
    lastCommitSha: { type: String, required: false, default: "" },
  },
  { timestamps: true }
);

export const Repository = model<IRepository>("Repository", RepositorySchema);
