import axios from 'axios';
import { getGithubContributions } from './githubService.js';
import type { Contribution } from './githubService.js';

/**
 * @typedef GithubUserInfo
 * @property {string} login
 * @property {string} name
 * @property {string} avatar_url
 * @property {number} followers
 * @property {number} following
 */
export interface GithubUserInfo {
  login: string;
  name: string;
  avatar_url: string;
  followers: number;
  following: number;
}

/**
 * @typedef YearContributionData
 * @property {number} year
 * @property {number} total
 * @property {Contribution[][]} contributions
 */
export interface YearContributionData {
  year: number;
  total: number;
  contributions: Contribution[][];
}

/**
 * @typedef GithubWallData
 * @property {string} username
 * @property {string} displayName
 * @property {string} avatarUrl
 * @property {number} followers
 * @property {number} following
 * @property {number} total
 * @property {number} years
 * @property {YearContributionData[]} contributions
 * @property {boolean} [isBeauty]
 * @property {string} [zoom]
 */
export interface GithubWallData {
  username: string;
  displayName: string;
  avatarUrl: string;
  followers: number;
  following: number;
  total: number;
  years: number;
  contributions: YearContributionData[];
  isBeauty?: boolean;
  zoom?: string;
}

/**
 * 获取GitHub用户的贡献墙数据
 * @param {string} username GitHub用户名
 * @param {number} year 年份，默认为当前年份，-1表示获取所有年份
 * @param {number} limit 限制返回的周数，默认为0（不限制）
 * @returns {Promise<GithubWallData>} 用户贡献数据和个人信息
 */
export async function getGithubWallData(
  username: string,
  year: number = -1,
  limit: number = 0
): Promise<GithubWallData> {
  try {
    if (!username) {
      throw new Error('Missing username');
    }

    // 获取用户个人信息
    const userInfo: GithubUserInfo = await fetchGithubUserInfo(username);

    let yearsData: YearContributionData[] = [];

    // 如果year为-1，获取所有年份的数据
    if (year === -1) {
      yearsData = await getAllYearsContributions(username);
    } else {
      // 获取指定年份的贡献数据
      const contributionData = await getGithubContributions(username, year, limit);
      // 将单个年份的数据按照相同的格式添加到数组中
      yearsData = [
        {
          year: year,
          total: contributionData.total,
          contributions: contributionData.contributions,
        },
      ];
    }

    let total = 0;
    yearsData.forEach((data) => {
      total += data.total;
    });

    // 返回统一的数据结构
    return {
      username: userInfo.login || username,
      displayName: userInfo.name || username,
      avatarUrl: userInfo.avatar_url || '',
      followers: userInfo.followers || 0,
      following: userInfo.following || 0,
      total: total,
      years: yearsData.length,
      contributions: yearsData,
    };
  } catch (error) {
    console.error('Error in getGithubWallData:', error);
    throw error;
  }
}

/**
 * 获取用户所有年份的贡献数据
 * @param {string} username GitHub用户名
 * @returns {Promise<YearContributionData[]>} 所有年份的贡献数据数组
 */
async function getAllYearsContributions(username: string): Promise<YearContributionData[]> {
  try {
    const currentYear = new Date().getFullYear();
    // 创建一个数组来存储所有年份的数据
    const allYearsData: YearContributionData[] = [];

    // 获取最近10年的数据
    for (let year = currentYear; year >= currentYear - 10; year--) {
      try {
        const yearData = await getGithubContributions(username, year, 0);
        // 将年份数据添加到数组中
        if (yearData.total > 0) {
          allYearsData.push({
            year: year,
            total: yearData.total,
            contributions: yearData.contributions,
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch data for year ${year}:`, error.message);
        // 如果某年数据获取失败，跳过该年
        continue;
      }
    }

    return allYearsData;
  } catch (error) {
    console.error('Error in getAllYearsContributions:', error);
    return [];
  }
}

/**
 * 获取GitHub用户的个人信息
 * @param {string} username GitHub用户名
 * @returns {Promise<GithubUserInfo>} 用户个人信息
 */
async function fetchGithubUserInfo(username: string): Promise<GithubUserInfo> {
  try {
    const response = await axios.get(`https://api.github.com/users/${username}`);
    return {
      login: response.data.login,
      name: response.data.name,
      avatar_url: response.data.avatar_url,
      followers: response.data.followers,
      following: response.data.following,
    };
  } catch (error) {
    console.error('Error fetching GitHub user info:', error);
    // 返回默认值，不中断主流程
    return {
      login: username,
      name: username,
      avatar_url: '',
      followers: 0,
      following: 0,
    };
  }
}
