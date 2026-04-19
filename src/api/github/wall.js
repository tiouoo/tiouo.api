import express from 'express';
import { getGithubWallData } from './contribution.js';
const router = express.Router();

/**
 * @swagger
 * /github/wall:
 *   get:
 *     summary: 返回GitHub用户的贡献墙HTML页面或SVG图片
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
 *       - in: query
 *         name: beauty
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 是否启用美化模式
 *       - in: query
 *         name: zoom
 *         schema:
 *           type: string
 *           default: "100"
 *         description: 缩放比例
 *       - in: query
 *         name: pic
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 是否返回SVG图片 (true) 或HTML页面 (false)
 *     responses:
 *       200:
 *         description: 成功获取贡献墙数据 (HTML或SVG)
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html>...</html>"
 *           image/svg+xml:
 *             schema:
 *               type: string
 *               example: "<svg>...</svg>"
 *       400:
 *         description: 缺少用户名参数
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "Missing username parameter"
 *       404:
 *         description: 用户不存在或无贡献数据
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "User does not exist or has no contributions"
 *       500:
 *         description: 内部服务器错误
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "Internal server error"
 */
router.get('/wall', async (req, res) => {
  try {
    const username = req.query.username;
    const year = Number(req.query.year ?? -1);
    const limit = Number(req.query.limit ?? 0);
    const isBeauty = req.query.beauty || false;
    const zoom = req.query.zoom;
    const isPic = req.query.pic === 'true';

    if (!username) {
      return res.status(400).render('error', {
        message: 'Missing username parameter',
      });
    }

    const wallData = await getGithubWallData(username, year, limit);

    if (!wallData.total && (!wallData.contributions || wallData.contributions.length === 0)) {
      return res.status(404).render('error', {
        message: 'User does not exist or has no contributions',
      });
    }

    if (isPic) {
      const svgContent = generateContributionSVG(wallData);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(svgContent);
    }

    wallData.isBeauty = isBeauty || false;
    wallData.zoom = zoom || '100';
    return res.render('github-wall', wallData);
  } catch (error) {
    console.error('Error rendering GitHub wall:', error);
    return res.status(500).render('error', {
      message: 'Internal server error\n' + JSON.stringify(error),
    });
  }
});

function generateContributionSVG(data) {
  const cellSize = 11;
  const cellSpacing = 2;
  const weekWidth = cellSize + cellSpacing;
  const contributionColors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

  const headerHeight = 60;
  const yearSpacing = 50;
  const leftPadding = 60;
  const dayLabelWidth = 30;

  let maxWeeks = 0;
  let totalHeight = headerHeight;
  const yearSections = [];

  data.contributions.forEach((yearData, yearIndex) => {
    const weeks = yearData.contributions.length;
    maxWeeks = Math.max(maxWeeks, weeks);

    const yearHeight = 30 + (cellSize + cellSpacing) * 7;

    const yearY = totalHeight;
    totalHeight += yearHeight + (yearIndex < data.contributions.length - 1 ? yearSpacing : 20);

    yearSections.push({
      year: yearData.year,
      weeks,
      y: yearY,
      height: yearHeight,
    });
  });

  const svgWidth = leftPadding + dayLabelWidth + maxWeeks * weekWidth;

  let svg = `<svg width="${svgWidth}" height="${totalHeight}" viewBox="0 0 ${svgWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">`;

  svg += `<rect width="${svgWidth}" height="${totalHeight}" fill="#ffffff"/>`;

  svg += `
        <style>
            text {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
                dominant-baseline: middle;
                text-anchor: start;
            }
            .title { font-size: 18px; font-weight: bold; fill: #24292e; }
            .subtitle { font-size: 14px; fill: #586069; }
            .year-title { font-size: 16px; font-weight: bold; fill: #24292e; }
            .month-label { font-size: 10px; fill: #586069; text-anchor: middle; }
            .day-label { font-size: 9px; fill: #586069; text-anchor: end; }
            .contrib-cell:hover { stroke: #777; stroke-width: 1px; }
        </style>
    `;

  svg += `<text x="20" y="25" class="title">${data.displayName}'s GitHub Contributions</text>`;
  svg += `<text x="20" y="45" class="subtitle">Total: ${data.total} contributions | Followers: ${data.followers} | Following: ${data.following}</text>`;

  data.contributions.forEach((yearData, yearIndex) => {
    const yearSection = yearSections[yearIndex];
    const baseY = yearSection ? yearSection.y : 0;

    svg += `<text x="20" y="${baseY + 20}" class="year-title">${yearData.year} (${yearData.total} contributions)</text>`;

    const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    dayLabels.forEach((day, i) => {
      if (day) {
        svg += `<text x="${leftPadding + dayLabelWidth - 5}" y="${baseY + 40 + i * (cellSize + cellSpacing) + cellSize / 2}" class="day-label">${day}</text>`;
      }
    });

    const monthPositions = [];
    yearData.contributions.forEach((week, weekIndex) => {
      if (week && week[0]) {
        const date = new Date(week[0].date);
        const month = date.getMonth();

        if (
          weekIndex === 0 ||
          new Date(yearData.contributions[weekIndex - 1][0].date).getMonth() !== month
        ) {
          monthPositions.push({
            month,
            x: leftPadding + dayLabelWidth + weekIndex * weekWidth,
          });
        }
      }
    });

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    monthPositions.forEach((pos, i) => {
      const nextX =
        i < monthPositions.length - 1
          ? monthPositions[i + 1].x
          : leftPadding + dayLabelWidth + yearData.contributions.length * weekWidth;
      const centerX = pos.x + (nextX - pos.x) / 2;

      svg += `<text x="${centerX}" y="${baseY + 30}" class="month-label">${monthNames[pos.month]}</text>`;
    });

    yearData.contributions.forEach((week, weekIndex) => {
      if (!week) return;

      week.forEach((day, dayIndex) => {
        if (day) {
          const intensity = Math.min(day.intensity, 4);
          const fillColor = contributionColors[intensity];
          const x = leftPadding + dayLabelWidth + weekIndex * weekWidth;
          const y = baseY + 40 + dayIndex * (cellSize + cellSpacing);

          svg += `<rect
                        x="${x}"
                        y="${y}"
                        width="${cellSize}"
                        height="${cellSize}"
                        fill="${fillColor}"
                        rx="2"
                        class="contrib-cell">
                        <title>${day.date}: ${day.count} contribution${day.count !== 1 ? 's' : ''}</title>
                    </rect>`;
        }
      });
    });
  });

  svg += `<text x="${svgWidth - 120}" y="${totalHeight - 10}" style="font-size: 10px; fill: #586069;">Generated by yiiko.api</text>`;

  svg += '</svg>';
  return svg;
}

export default router;
