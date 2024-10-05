import express from "express";
import mongoose from "mongoose";
import { config } from "./config/config";
import { initTelegramBot } from "./services/telegramService";
import { checkRepositories } from "./services/githubService";
import { logger } from "./utils/logger";

export const app = express();

mongoose
  .connect(config.mongodbUri)
  .then(() => logger.info("Connected to MongoDB"))
  .catch((error) => logger.error("MongoDB connection error", { error }));

initTelegramBot();

setInterval(checkRepositories, config.checkInterval);

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});
