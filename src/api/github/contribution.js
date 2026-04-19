import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: GitHub
 *   description: GitHub数据相关API
 * /github/contribution:
 *   get:
 *     summary: 获取GitHub用户的贡献日历数据
 *     tags: [GitHub]
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *         description: GitHub用户名
 *       - in: query
 *         name: year
 *         schema:
 *           type: number
 *           default: -1
 *         description: 指定年份的贡献数据，-1表示所有年份
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 0
 *         description: 限制返回的贡献数据数量
 *     responses:
 *       200:
 *         description: 成功获取贡献数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                   example: 1234
 *                 contributions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       count:
 *                         type: number
 *                       intensity:
 *                         type: number
 *       400:
 *         description: 缺少用户名参数
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error: Missing username"
 *       404:
 *         description: 用户不存在或无贡献数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error: User does not exist"
 *       500:
 *         description: 内部服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error: Internal server error"
 */
router.get('/', async (req, res) => {
  try {
    const username = req.query.username;
    const year = Number(req.query.year ?? -1);
    const limit = Number(req.query.limit ?? 0);

    if (!username) {
      return res.status(400).json({ error: 'Error: Missing username' });
    }

    const userData = await getGithubContributions(username, year, limit);

    if (!userData.total && !userData.contributions) {
      return res.status(404).json({ error: 'Error: User does not exist' });
    }

    return res.status(200).json(userData);
  } catch (error) {
    console.error('Error fetching GitHub contribution data:', error);
    return res.status(500).json({ error: 'Error: Internal server error' });
  }
});

async function getGithubWallData(username, year = -1, limit = 0) {
  try {
    if (!username) {
      throw new Error('Missing username');
    }

    const userInfo = await fetchGithubUserInfo(username);

    let yearsData = [];

    if (year === -1) {
      yearsData = await getAllYearsContributions(username);
    } else {
      const contributionData = await getGithubContributions(username, year, limit);
      yearsData = [
        {
          year,
          total: contributionData.total,
          contributions: contributionData.contributions,
        },
      ];
    }

    let total = 0;
    yearsData.forEach((data) => {
      total += data.total;
    });

    return {
      username: userInfo.login || username,
      displayName: userInfo.name || username,
      avatarUrl: userInfo.avatar_url || '',
      followers: userInfo.followers || 0,
      following: userInfo.following || 0,
      total,
      years: yearsData.length,
      contributions: yearsData,
    };
  } catch (error) {
    console.error('Error in getGithubWallData:', error);
    throw error;
  }
}

async function getAllYearsContributions(username) {
  try {
    const currentYear = new Date().getFullYear();
    const allYearsData = [];

    for (let year = currentYear; year >= currentYear - 10; year--) {
      try {
        const yearData = await getGithubContributions(username, year, 0);
        if (yearData.total > 0) {
          allYearsData.push({
            year,
            total: yearData.total,
            contributions: yearData.contributions,
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch data for year ${year}:`, error.message);
        continue;
      }
    }

    return allYearsData;
  } catch (error) {
    console.error('Error in getAllYearsContributions:', error);
    return [];
  }
}

async function fetchGithubUserInfo(username) {
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
    return {
      login: username,
      name: username,
      avatar_url: '',
      followers: 0,
      following: 0,
    };
  }
}

async function getGithubContributions(username, year = -1, limit = 0) {
  try {
    if (!username) {
      throw new Error('Missing username');
    }

    const url = `https://github.com/users/${username}/contributions?to=${year > 0 ? year : new Date().getFullYear()}-01-01`;

    const response = await axios.get(url);
    const html = response.data;

    const $ = cheerio.load(html);

    const contributionText = $('.js-yearly-contributions h2').text().trim();
    const totalMatch = contributionText.match(/[0-9,]+/);
    const total = totalMatch ? parseInt(totalMatch[0].replace(/,/g, ''), 10) : 0;

    const data = {};

    $('.js-calendar-graph .ContributionCalendar-day').each((_idx, element) => {
      const el = $(element);
      const tooltipId = el.attr('id');
      if (!tooltipId) return;

      const date = el.attr('data-date');
      const intensity = parseInt(el.attr('data-level') || '0', 10);

      if (!date) return;

      data[tooltipId] = {
        date,
        intensity,
        count: 0,
      };
    });

    $('.js-calendar-graph tool-graph tool-tip').each((_idx, element) => {
      const el = $(element);
      const tooltipId = el.attr('for');
      if (!tooltipId || !data[tooltipId]) return;

      const tooltipText = el.text().trim();
      const countMatch = tooltipText.match(/^([0-9]+)/);
      const count = countMatch && countMatch[1] ? parseInt(countMatch[1], 10) : 0;

      data[tooltipId].count = count;
    });

    const contributions = [];
    let weekIndex;

    Object.values(data)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(...(limit ? [0, limit * 7] : []))
      .forEach((day, idx) => {
        weekIndex = Math.floor(idx / 7);
        if (!contributions[weekIndex]) {
          contributions[weekIndex] = [];
        }
        contributions[weekIndex].push(day);
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

export default router;
export { getGithubWallData, getGithubContributions };
