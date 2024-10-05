import { Octokit } from "@octokit/rest";
import { config } from "../config/config";
import { Repository } from "../models/Repository";
import { sendNotification } from "./telegramService";
import { logger } from "../utils/logger";

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

        if (commits.length > 0 && commits[0].sha !== repo.lastCommitSha) {
          const latestCommit = commits[0];
          repo.lastCommitSha = latestCommit.sha;
          await repo.save();

          const message = `Новый коммит в репозитории ${repo.fullName}:
Автор: ${latestCommit.commit.author?.name}
Время: ${latestCommit.commit.author?.date}
Сообщение: ${latestCommit.commit.message}
Ссылка: ${latestCommit.html_url}`;

          for (const userId of repo.users) {
            await sendNotification(userId, message);
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
