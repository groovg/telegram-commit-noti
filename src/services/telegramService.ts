import TelegramBot, { Message } from "node-telegram-bot-api";
import { config } from "../config/config";
import { Repository } from "../models/Repository";
import { logger } from "../utils/logger";
import { checkUserExists, checkRepoExists } from "./githubService";
import moment from "moment-timezone";

const bot = new TelegramBot(config.telegramBotToken, { polling: true });

const formatCommitTime = (message: Message, commitTime: string): string => {
  const userTimezone = message.chat.timezone || "UTC";
  return moment(commitTime).tz(userTimezone).format("YYYY-MM-DD HH:mm:ss");
};

export const initTelegramBot = () => {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(
      chatId,
      "Привет! Я бот для отслеживания коммитов на GitHub. Используйте /repository_add <автор> <репозиторий> для добавления репозитория."
    );
  });

  bot.onText(/\/repository_add (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!match || match[1].split(" ").length !== 2) {
      await bot.sendMessage(
        chatId,
        "Пожалуйста, используйте формат: /repository_add <автор> <репозиторий>"
      );
      return;
    }
    const [author, repoName] = match[1].split(" ");
    const fullName = `${author}/${repoName}`;
    try {
      // Проверяем существование пользователя
      const userExists = await checkUserExists(author);
      if (!userExists) {
        await bot.sendMessage(
          chatId,
          `Пользователь "${author}" не существует на GitHub. Пожалуйста, проверьте правильность имени пользователя.`
        );
        return;
      }

      // Проверяем существование репозитория
      const repoExists = await checkRepoExists(author, repoName);
      if (!repoExists) {
        await bot.sendMessage(
          chatId,
          `Репозиторий "${repoName}" не найден у пользователя ${author}. Пожалуйста, проверьте правильность названия репозитория.`
        );
        return;
      }

      let repo = await Repository.findOne({ fullName });
      if (!repo) {
        repo = new Repository({
          fullName,
          users: [chatId.toString()],
          lastCommitSha: "",
        });
      } else if (!repo.users.includes(chatId.toString())) {
        repo.users.push(chatId.toString());
      }
      await repo.save();
      await bot.sendMessage(
        chatId,
        `Репозиторий ${fullName} добавлен для отслеживания.`
      );
    } catch (error) {
      logger.error("Error adding repository", { error });
      await bot.sendMessage(
        chatId,
        "Произошла ошибка при добавлении репозитория. Пожалуйста, попробуйте позже или обратитесь к администратору."
      );
    }
  });

  bot.onText(/\/repository_remove (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!match || match[1].split(" ").length !== 2) {
      await bot.sendMessage(
        chatId,
        "Пожалуйста, используйте формат: /repository_remove <автор> <репозиторий>"
      );
      return;
    }
    const [author, repoName] = match[1].split(" ");
    const fullName = `${author}/${repoName}`;
    try {
      const repo = await Repository.findOne({ fullName });
      if (repo) {
        repo.users = repo.users.filter((id) => id !== chatId.toString());
        if (repo.users.length === 0) {
          await Repository.deleteOne({ fullName });
        } else {
          await repo.save();
        }
        await bot.sendMessage(
          chatId,
          `Репозиторий ${fullName} удален из отслеживания.`
        );
      } else {
        await bot.sendMessage(
          chatId,
          `Репозиторий ${fullName} не найден в списке отслеживаемых.`
        );
      }
    } catch (error) {
      logger.error("Error removing repository", { error });
      await bot.sendMessage(
        chatId,
        "Произошла ошибка при удалении репозитория."
      );
    }
  });
};

export const sendNotification = async (
  msg: Message,
  fullName: string,
  author: string,
  commitTime: string,
  commitUrl: string,
  commitMessage: string
) => {
  try {
    const formattedTime = formatCommitTime(msg, commitTime);
    const message = `Новый коммит в репозитории ${fullName}:
Автор: ${author}
Время: ${formattedTime}
Сообщение: ${commitMessage}
Ссылка: ${commitUrl}`;
    await bot.sendMessage(msg.chat.id, message, { parse_mode: "HTML" });
  } catch (error) {
    logger.error("Error sending notification", { error, chatId: msg.chat.id });
  }
};
