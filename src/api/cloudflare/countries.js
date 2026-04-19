import express from 'express';
import axios from 'axios';
const router = express.Router();

/**
 * @swagger
 * /cloudflare/countries:
 *   get:
 *     summary: 获取区域请求数据（用于柱状图）
 *     tags: [Cloudflare]
 *     parameters:
 *       - in: query
 *         name: cf_account_id
 *         schema:
 *           type: string
 *         required: true
 *         description: Cloudflare账户ID
 *       - in: query
 *         name: cf_api_token
 *         schema:
 *           type: string
 *         required: true
 *         description: Cloudflare API Token
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: 查询天数（默认7天）
 *     responses:
 *       200:
 *         description: 成功获取国家/地区数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       country:
 *                         type: string
 *                       requests:
 *                         type: number
 *                       bytes:
 *                         type: number
 *                       timeSeries:
 *                         type: array
 *       400:
 *         description: 缺少必填参数
 *       500:
 *         description: 服务器错误
 */
router.get('/countries', async (req, res) => {
  try {
    const cfAccountId = req.query.cf_account_id;
    const cfApiToken = req.query.cf_api_token;
    if (!cfApiToken || !cfAccountId) {
      return res.status(400).json({ success: false, error: 'Missing cf_account_id or cf_api_token parameter' });
    }
    const days = parseInt(req.query.days) || 7;
    const data = await getCountryAnalytics(days, cfAccountId, cfApiToken);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching country analytics:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function getCountryAnalytics(days = 7, cfAccountId, cfApiToken) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d) => (d.toISOString().split("T")[0] || "");

  const query = `
    query GetCountryAnalytics($accountTag: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          httpRequests1dGroups(
            limit: 1000
            filter: { date_geq: $start, date_lt: $end }
          ) {
            dimensions {
              date
            }
            sum {
              requests
              bytes
              countryMap {
                clientCountryName
                requests
                bytes
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        query,
        variables: {
          accountTag: cfAccountId,
          start: formatDate(startDate),
          end: formatDate(now),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${cfApiToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errors) {
      console.error("GraphQL errors:", response.data.errors);
      return [];
    }

    const accounts = response.data?.data?.viewer?.accounts;
    if (!accounts || accounts.length === 0) {
      return [];
    }

    const groups = accounts[0].httpRequests1dGroups || [];

    const countryMap = new Map();
    const countryTimeSeries = new Map();

    groups.forEach((group) => {
      const date = group.dimensions?.date;
      const countries = group.sum?.countryMap || [];

      countries.forEach((country) => {
        const name = country.clientCountryName || "Unknown";

        if (!countryMap.has(name)) {
          countryMap.set(name, { requests: 0, bytes: 0 });
        }
        const existing = countryMap.get(name);
        if (existing) {
          existing.requests += country.requests || 0;
          existing.bytes += country.bytes || 0;
        }

        if (!countryTimeSeries.has(name)) {
          countryTimeSeries.set(name, []);
        }
        countryTimeSeries.get(name)?.push({
          date,
          requests: country.requests || 0,
          bytes: country.bytes || 0,
        });
      });
    });

    const result = Array.from(countryMap.entries())
      .map(([country, data]) => ({
        country,
        requests: data.requests,
        bytes: data.bytes,
        timeSeries: countryTimeSeries.get(country) || [],
      }))
      .sort((a, b) => b.requests - a.requests);

    return result;
  } catch (error) {
    console.error(
      "Country analytics query error:",
      error.response?.data || error.message
    );
    return [];
  }
}

export default router;
