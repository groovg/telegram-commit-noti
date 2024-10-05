import { Schema, model, Document } from "mongoose";

interface IRepository extends Document {
  fullName: string;
  users: string[];
  lastCommitSha: string;
  addedAt: Date;
  createdAt: Date; // Добавляем createdAt
  updatedAt: Date; // Добавляем updatedAt
}

const RepositorySchema = new Schema<IRepository>(
  {
    fullName: { type: String, required: true, unique: true },
    users: [{ type: String, required: true }],
    lastCommitSha: { type: String, required: false, default: "" },
  },
  { timestamps: true }
); // Добавляем timestamps для автоматического создания полей createdAt и updatedAt

export const Repository = model<IRepository>("Repository", RepositorySchema);
