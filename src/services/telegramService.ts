import TelegramBot, { Message } from "node-telegram-bot-api";
import { config } from "../config/config";
import { Repository } from "../models/Repository";
import { logger } from "../utils/logger";
import { checkUserExists, checkRepoExists } from "./githubService";

const bot = new TelegramBot(config.telegramBotToken, { polling: true });

export const initTelegramBot = () => {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(
      chatId,
      "Привет! Я бот для отслеживания коммитов на GitHub. Используйте:\n" +
        "/repository_add <автор> <репозиторий> или <ссылка на репозиторий> для добавления репозитория.\n" +
        "/repository_remove <автор> <репозиторий> или <ссылка на репозиторий> для удаления репозитория.\n" +
        "/repository_list для просмотра всех добавленных репозиториев.\n" +
        "/help для получения списка всех доступных команд."
    );
  });

  bot.onText(/\/(.*)/, async (msg) => {
    const chatId = msg.chat.id;
    const command = msg.text;

    if (!command || !command.startsWith("/")) return; // Ignore non-command messages

    // Check if the command exists
    const knownCommands = [
      "/repository_add",
      "/repository_remove",
      "/repository_list",
      "/help",
      // Add any other commands you have here
    ];

    if (!knownCommands.some((cmd) => command.startsWith(cmd))) {
      await bot.sendMessage(
        chatId,
        `Команда "${command}" не найдена. Для списка команд напишите /help.`
      );
    }
  });

  bot.onText(/\/repository_list/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const repos = await Repository.find({ users: chatId.toString() });
      if (repos.length === 0) {
        await bot.sendMessage(chatId, "У вас нет добавленных репозиториев.");
        return;
      }

      const repoList = repos
        .map((repo) => {
          return `${repo.fullName} - Последний коммит: ${
            repo.lastCommitSha || "Нет данных"
          }`;
        })
        .join("\n");

      await bot.sendMessage(chatId, `Ваши репозитории:\n${repoList}`);
    } catch (error) {
      logger.error("Error fetching repositories", { error });
      await bot.sendMessage(
        chatId,
        "Произошла ошибка при получении списка репозиториев."
      );
    }
  });

  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(
      chatId,
      "Доступные команды:\n" +
        "/repository_add <автор> <репозиторий> или <ссылка на репозиторий> - Добавить репозиторий для отслеживания.\n" +
        "/repository_remove <автор>/<репозиторий> или <ссылка на репозиторий> - Удалить репозиторий из отслеживания.\n" +
        "/repository_list - Просмотреть все добавленные репозитории.\n" +
        "/help - Получить список всех команд."
    );
  });

  bot.onText(/\/repository_add (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    if (!match || match[1].trim() === "") {
      await bot.sendMessage(
        chatId,
        "Пожалуйста, укажите репозиторий в формате: /repository_add <автор> <репозиторий> или <ссылка на репозиторий>"
      );
      return;
    }

    const input = match[1].trim();
    let fullName: string;

    // Check if the input is a GitHub URL
    if (input.startsWith("https://github.com/")) {
      const parts = input.split("/");
      if (parts.length !== 5) {
        await bot.sendMessage(
          chatId,
          "Пожалуйста, используйте корректную ссылку на репозиторий GitHub."
        );
        return;
      }
      const owner = parts[3];
      const repoName = parts[4];
      fullName = `${owner}/${repoName}`;
    } else {
      const splitInput = input.split(" ");
      if (splitInput.length !== 2) {
        await bot.sendMessage(
          chatId,
          "Пожалуйста, используйте формат: /repository_add <автор> <репозиторий>"
        );
        return;
      }
      const [author, repoName] = splitInput;
      fullName = `${author}/${repoName}`;
    }

    // Check if the repository exists
    const [owner, repo] = fullName.split("/");
    const userExists = await checkUserExists(owner);
    const repoExists = await checkRepoExists(owner, repo);

    if (!userExists || !repoExists) {
      await bot.sendMessage(
        chatId,
        "Пожалуйста, проверьте корректность юзернейма или репозитория."
      );
      return;
    }

    try {
      let repo = await Repository.findOne({ fullName });

      // Check if the repository already exists
      if (repo) {
        if (!repo.users.includes(chatId.toString())) {
          repo.users.push(chatId.toString());
          await repo.save();
          await bot.sendMessage(
            chatId,
            `Вы добавили репозиторий ${fullName} для отслеживания.`
          );
        } else {
          await bot.sendMessage(
            chatId,
            `Репозиторий ${fullName} уже добавлен для отслеживания.`
          );
        }
      } else {
        repo = new Repository({
          fullName,
          users: [chatId.toString()],
          lastCommitSha: "",
        });
        await repo.save();
        await bot.sendMessage(
          chatId,
          `Репозиторий ${fullName} добавлен для отслеживания.`
        );
      }
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
    if (!match || match[1].trim() === "") {
      await bot.sendMessage(
        chatId,
        "Пожалуйста, укажите репозиторий в формате: /repository_remove <автор> <репозиторий>"
      );
      return;
    }

    if (!match || match.length < 2) {
      await bot.sendMessage(
        chatId,
        "Пожалуйста, используйте формат: /repository_remove <автор>/<репозиторий> или <ссылка на репозиторий>"
      );
      return;
    }

    const input = match[1].trim();
    let fullName: string;

    if (input.startsWith("https://github.com/")) {
      const parts = input.split("/");
      if (parts.length !== 5) {
        await bot.sendMessage(
          chatId,
          "Пожалуйста, используйте корректную ссылку на репозиторий GitHub."
        );
        return;
      }
      const owner = parts[3];
      const repoName = parts[4];
      fullName = `${owner}/${repoName}`;
    } else if (input.split(" ").length === 2) {
      const [author, repoName] = input.split(" ");
      fullName = `${author}/${repoName}`;
    } else {
      await bot.sendMessage(
        chatId,
        "Пожалуйста, используйте формат: /repository_remove <автор> <репозиторий> или <ссылка на репозиторий>"
      );
      return;
    }

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

export const sendNotification = async (chatId: string, message: string) => {
  try {
    await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
  } catch (error) {
    logger.error("Error sending notification", { error, chatId });
  }
};
