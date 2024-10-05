import dotenv from "dotenv";

dotenv.config();

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
  githubToken: process.env.GITHUB_TOKEN!,
  mongodbUri: process.env.MONGODB_URI!,
  checkInterval: 30 * 60 * 1000, // 30 минут в миллисекундах
};
