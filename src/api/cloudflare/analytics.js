import express from 'express';
import axios from 'axios';
import { getZones } from './zones.js';
const router = express.Router();

/**
 * @swagger
 * /cloudflare/analytics:
 *   get:
 *     summary: 获取Cloudflare账户分析数据
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
 *         description: 成功获取分析数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     requests:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: number
 *                         change:
 *                           type: number
 *                     bandwidth:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: number
 *                         change:
 *                           type: number
 *                     visits:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: number
 *                         change:
 *                           type: number
 *                     pageViews:
 *                       type: object
 *                       properties:
 *                         value:
 *                           type: number
 *                         change:
 *                           type: number
 *                     period:
 *                       type: object
 *       400:
 *         description: 缺少必填参数
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Missing cf_account_id or cf_api_token parameter"
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 */
router.get('/', async (req, res) => {
  try {
    const cfAccountId = req.query.cf_account_id;
    const cfApiToken = req.query.cf_api_token;
    if (!cfApiToken || !cfAccountId) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing cf_account_id or cf_api_token parameter' });
    }
    const days = parseInt(req.query.days) || 7;
    const data = await getAccountAnalytics(days, cfAccountId, cfApiToken);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching Cloudflare analytics:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function queryAccountAnalytics(startDate, endDate, cfAccountId, cfApiToken) {
  const query = `
    query GetAccountAnalytics($accountTag: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          httpRequests1dGroups(
            limit: 100
            filter: { date_geq: $start, date_lt: $end }
          ) {
            sum {
              requests
              bytes
              pageViews
            }
            uniq {
              uniques
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      'https://api.cloudflare.com/client/v4/graphql',
      {
        query,
        variables: {
          accountTag: cfAccountId,
          start: startDate,
          end: endDate,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${cfApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.errors) {
      console.error('GraphQL errors:', response.data.errors);
      return { requests: 0, bandwidth: 0, visits: 0, pageViews: 0 };
    }

    const accounts = response.data?.data?.viewer?.accounts;
    if (!accounts || accounts.length === 0) {
      return await queryZonesAnalytics(startDate, endDate, cfApiToken);
    }

    const groups = accounts[0].httpRequests1dGroups || [];
    let requests = 0,
      bandwidth = 0,
      visits = 0,
      pageViews = 0;

    groups.forEach((group) => {
      requests += group.sum?.requests || 0;
      bandwidth += group.sum?.bytes || 0;
      pageViews += group.sum?.pageViews || 0;
      visits += group.uniq?.uniques || 0;
    });

    return { requests, bandwidth, visits, pageViews };
  } catch (error) {
    console.error('GraphQL query error:', error.response?.data || error.message);
    return { requests: 0, bandwidth: 0, visits: 0, pageViews: 0 };
  }
}

async function queryZonesAnalytics(startDate, endDate, cfApiToken) {
  const zones = await getZones(cfApiToken);
  if (zones.length === 0) {
    return { requests: 0, bandwidth: 0, visits: 0, pageViews: 0 };
  }

  const query = `
    query GetZoneAnalytics($zoneTag: String!, $start: Date!, $end: Date!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 100
            filter: { date_geq: $start, date_lt: $end }
          ) {
            sum {
              requests
              bytes
              pageViews
            }
            uniq {
              uniques
            }
          }
        }
      }
    }
  `;

  const results = await Promise.all(
    zones.map(async (zone) => {
      try {
        const response = await axios.post(
          'https://api.cloudflare.com/client/v4/graphql',
          {
            query,
            variables: {
              zoneTag: zone.id,
              start: startDate,
              end: endDate,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${cfApiToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const zoneData = response.data?.data?.viewer?.zones?.[0];
        const groups = zoneData?.httpRequests1dGroups || [];
        let requests = 0,
          bandwidth = 0,
          visits = 0,
          pageViews = 0;

        groups.forEach((group) => {
          requests += group.sum?.requests || 0;
          bandwidth += group.sum?.bytes || 0;
          pageViews += group.sum?.pageViews || 0;
          visits += group.uniq?.uniques || 0;
        });

        return { requests, bandwidth, visits, pageViews };
      } catch {
        return { requests: 0, bandwidth: 0, visits: 0, pageViews: 0 };
      }
    })
  );

  return results.reduce(
    (acc, curr) => ({
      requests: acc.requests + curr.requests,
      bandwidth: acc.bandwidth + curr.bandwidth,
      visits: acc.visits + curr.visits,
      pageViews: acc.pageViews + curr.pageViews,
    }),
    { requests: 0, bandwidth: 0, visits: 0, pageViews: 0 }
  );
}

async function getAccountAnalytics(days = 7, cfAccountId, cfApiToken) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - days);

  const formatDate = (d) => d.toISOString().split('T')[0] || '';

  try {
    const [current, prev] = await Promise.all([
      queryAccountAnalytics(formatDate(startDate), formatDate(now), cfAccountId, cfApiToken),
      queryAccountAnalytics(
        formatDate(prevStartDate),
        formatDate(startDate),
        cfAccountId,
        cfApiToken
      ),
    ]);

    const calcChange = (curr, previous) => {
      if (previous === 0) return curr > 0 ? 100 : 0;
      return ((curr - previous) / previous) * 100;
    };

    return {
      requests: {
        value: current.requests,
        change: calcChange(current.requests, prev.requests),
      },
      bandwidth: {
        value: current.bandwidth,
        change: calcChange(current.bandwidth, prev.bandwidth),
      },
      visits: {
        value: current.visits,
        change: calcChange(current.visits, prev.visits),
      },
      pageViews: {
        value: current.pageViews,
        change: calcChange(current.pageViews, prev.pageViews),
      },
      period: {
        start: formatDate(startDate),
        end: formatDate(now),
        days,
      },
    };
  } catch (error) {
    console.error('Error in getAccountAnalytics:', error.message);
    return {
      error: error.message,
      requests: { value: 0, change: 0 },
      bandwidth: { value: 0, change: 0 },
      visits: { value: 0, change: 0 },
      pageViews: { value: 0, change: 0 },
      period: { start: '', end: '', days: 0 },
    };
  }
}

export default router;
