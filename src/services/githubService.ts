import { Octokit } from "@octokit/rest";
import { config } from "../config/config";
import { Repository } from "../models/Repository";
import { sendNotification } from "./telegramService";
import { logger } from "../utils/logger";
import moment from "moment";

const octokit = new Octokit({ auth: config.githubToken });

export const checkUserExists = async (username: string): Promise<boolean> => {
  try {
    await octokit.users.getByUsername({ username });
    return true;
  } catch (error: any) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
};

export const checkRepoExists = async (
  owner: string,
  repo: string
): Promise<boolean> => {
  try {
    await octokit.repos.get({ owner, repo });
    return true;
  } catch (error: any) {
    if (error.status === 404) {
      return false;
    }
    throw error;
  }
};

export const checkRepositories = async () => {
  try {
    const repositories = await Repository.find();
    for (const repo of repositories) {
      try {
        const [owner, repoName] = repo.fullName.split("/");
        const { data: commits } = await octokit.repos.listCommits({
          owner,
          repo: repoName,
          per_page: 1,
        });

        if (commits.length > 0) {
          const latestCommit = commits[0];
          const commitDate = new Date(latestCommit.commit.author?.date || "");

          if (
            commitDate > new Date(repo.createdAt) &&
            latestCommit.sha !== repo.lastCommitSha
          ) {
            repo.lastCommitSha = latestCommit.sha;
            await repo.save();

            const message = `Новый коммит в репозитории ${repo.fullName}:
Автор: ${latestCommit.commit.author?.name}
Время: ${moment(commitDate).utc().format("DD.MM.YYYY HH:mm:ss")} UTC
Сообщение: ${latestCommit.commit.message}
Ссылка: <a href="https://github.com/${repo.fullName}/commit/${
              latestCommit.sha
            }">${latestCommit.sha}</a>`;

            for (const userId of repo.users) {
              await sendNotification(userId, message);
            }
          }
        }
      } catch (error) {
        logger.error("Error checking repository", {
          error,
          repository: repo.fullName,
        });
      }
    }
  } catch (error) {
    logger.error("Error fetching repositories", { error });
  }
};
