import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * @typedef Contribution
 * @property {string} date
 * @property {number} count
 * @property {(0 | 1 | 2 | 3 | 4)} intensity
 */
export interface Contribution {
  date: string;
  count: number;
  intensity: 0 | 1 | 2 | 3 | 4;
}

/**
 * 获取GitHub用户的贡献日历数据（使用网页爬取方式）
 * @param {string} username GitHub用户名
 * @param {number} year 年份，默认为-1（当前年份）
 * @param {number} limit 限制返回的周数，默认为0（不限制）
 * @returns {Promise<{ total: number, contributions: Contribution[][] }>}
 */
export async function getGithubContributions(
  username: string,
  year: number = -1,
  limit: number = 0
): Promise<{ total: number; contributions: Contribution[][] }> {
  try {
    if (!username) {
      throw new Error('Missing username');
    }

    // 构建GitHub贡献页面URL
    const url = `https://github.com/users/${username}/contributions?to=${year > 0 ? year : new Date().getFullYear()}-01-01`;

    // 获取HTML内容
    const response = await axios.get(url);
    const html = response.data;

    // 使用cheerio解析HTML
    const $ = cheerio.load(html);

    // 获取总贡献数
    const contributionText = $('.js-yearly-contributions h2').text().trim();
    const totalMatch = contributionText.match(/[0-9,]+/);
    const total = totalMatch ? parseInt(totalMatch[0].replace(/,/g, ''), 10) : 0;

    // 收集每日贡献数据
    const data: { [key: string]: Contribution } = {};

    $('.js-calendar-graph .ContributionCalendar-day').each((_idx: number, element) => {
      const el = $(element);
      const tooltipId = el.attr('id');
      if (!tooltipId) return;

      const date = el.attr('data-date');
      const intensity = parseInt(el.attr('data-level') || '0', 10) as 0 | 1 | 2 | 3 | 4;

      if (!date) return;

      data[tooltipId] = {
        date,
        intensity,
        count: 0,
      };
    });

    // 获取贡献计数
    $('.js-calendar-graph tool-graph tool-tip').each((_idx: number, element) => {
      const el = $(element);
      const tooltipId = el.attr('for');
      if (!tooltipId || !data[tooltipId]) return;

      const tooltipText = el.text().trim();
      const countMatch = tooltipText.match(/^([0-9]+)/);
      const count = countMatch && countMatch[1] ? parseInt(countMatch[1], 10) : 0;

      data[tooltipId].count = count;
    });

    // 整理数据格式
    const contributions: Contribution[][] = [];
    let weekIndex: number;

    Object.values(data)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(...(limit ? [0, limit * 7] : []))
      .forEach((day, idx) => {
        weekIndex = Math.floor(idx / 7);
        if (!contributions[weekIndex]) {
          contributions[weekIndex] = [];
        }
        (contributions[weekIndex] as Contribution[]).push(day);
      });

    return {
      total,
      contributions,
    };
  } catch (error) {
    console.error('Error in getGithubContributions:', error);
    throw error;
  }
}
