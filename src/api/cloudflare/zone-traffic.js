import express from 'express';
import axios from 'axios';
import { getZones } from './zones.js';
const router = express.Router();

/**
 * @swagger
 * /cloudflare/zone-traffic:
 *   get:
 *     summary: 获取单个域名的Web流量统计
 *     tags: [Cloudflare]
 *     parameters:
 *       - in: query
 *         name: cf_api_token
 *         schema:
 *           type: string
 *         required: true
 *         description: Cloudflare API Token
 *       - in: query
 *         name: zone
 *         schema:
 *           type: string
 *           default: "yik.at"
 *         description: 域名名称
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: 查询天数（默认7天）
 *     responses:
 *       200:
 *         description: 成功获取流量数据
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
 *                         total:
 *                           type: number
 *                         cached:
 *                           type: number
 *                         uncached:
 *                           type: number
 *                         max:
 *                           type: number
 *                         min:
 *                           type: number
 *                     bandwidth:
 *                       type: object
 *                     visitors:
 *                       type: object
 *                     timeSeries:
 *                       type: array
 *                     period:
 *                       type: object
 *       400:
 *         description: 缺少cf_api_token参数
 *       500:
 *         description: 服务器错误
 */
router.get('/zone-traffic', async (req, res) => {
  try {
    const cfApiToken = req.query.cf_api_token;
    if (!cfApiToken) {
      return res.status(400).json({ success: false, error: 'Missing cf_api_token parameter' });
    }
    const zoneName = req.query.zone || 'yik.at';
    const days = parseInt(req.query.days) || 7;
    const data = await getZoneWebTraffic(zoneName, days, cfApiToken);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching zone traffic:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function getZoneWebTraffic(zoneName, days = 7, cfApiToken) {
  const zoneId = await getZoneIdByName(zoneName, cfApiToken);
  if (!zoneId) {
    return { error: `Zone not found: ${zoneName}`, requests: { total: 0, cached: 0, uncached: 0, max: 0, min: 0 }, bandwidth: { total: 0, cached: 0, uncached: 0, max: 0, min: 0 }, visitors: { total: 0, max: 0, min: 0 }, timeSeries: [], period: { start: '', end: '', days: 0 } };
  }

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d) => (d.toISOString().split("T")[0] || "");

  if (days <= 1) {
    return await getZoneWebTrafficHourly(zoneId, startDate, now, cfApiToken);
  }

  const query = `
    query GetZoneWebTraffic($zoneTag: String!, $start: Date!, $end: Date!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 100
            filter: { date_geq: $start, date_lt: $end }
            orderBy: [date_ASC]
          ) {
            dimensions {
              date
            }
            sum {
              requests
              cachedRequests
              bytes
              cachedBytes
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
      "https://api.cloudflare.com/client/v4/graphql",
      {
        query,
        variables: {
          zoneTag: zoneId,
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
      return getEmptyWebTraffic();
    }

    const zones = response.data?.data?.viewer?.zones;
    if (!zones || zones.length === 0) {
      return getEmptyWebTraffic();
    }

    const groups = zones[0].httpRequests1dGroups || [];

    let totalRequests = 0,
      cachedRequests = 0,
      totalBytes = 0,
      cachedBytes = 0,
      totalVisitors = 0;
    let maxRequests = 0,
      minRequests = Infinity,
      maxBytes = 0,
      minBytes = Infinity,
      maxVisitors = 0,
      minVisitors = Infinity;

    const timeSeries = groups.map((group) => {
      const requests = group.sum?.requests || 0;
      const cached = group.sum?.cachedRequests || 0;
      const bytes = group.sum?.bytes || 0;
      const cachedB = group.sum?.cachedBytes || 0;
      const visitors = group.uniq?.uniques || 0;

      totalRequests += requests;
      cachedRequests += cached;
      totalBytes += bytes;
      cachedBytes += cachedB;
      totalVisitors += visitors;

      maxRequests = Math.max(maxRequests, requests);
      minRequests = Math.min(minRequests, requests);
      maxBytes = Math.max(maxBytes, bytes);
      minBytes = Math.min(minBytes, bytes);
      maxVisitors = Math.max(maxVisitors, visitors);
      minVisitors = Math.min(minVisitors, visitors);

      return {
        date: group.dimensions?.date,
        requests,
        cachedRequests: cached,
        uncachedRequests: requests - cached,
        bytes,
        cachedBytes: cachedB,
        uncachedBytes: bytes - cachedB,
        visitors,
        isHourly: false,
      };
    });

    if (minRequests === Infinity) minRequests = 0;
    if (minBytes === Infinity) minBytes = 0;
    if (minVisitors === Infinity) minVisitors = 0;

    return {
      requests: {
        total: totalRequests,
        cached: cachedRequests,
        uncached: totalRequests - cachedRequests,
        max: maxRequests,
        min: minRequests,
      },
      bandwidth: {
        total: totalBytes,
        cached: cachedBytes,
        uncached: totalBytes - cachedBytes,
        max: maxBytes,
        min: minBytes,
      },
      visitors: {
        total: totalVisitors,
        max: maxVisitors,
        min: minVisitors,
      },
      timeSeries,
      period: { start: formatDate(startDate), end: formatDate(now), days },
    };
  } catch (error) {
    console.error(
      "Zone web traffic query error:",
      error.response?.data || error.message
    );
    return getEmptyWebTraffic();
  }
}

async function getZoneWebTrafficHourly(zoneId, startDate, endDate, cfApiToken) {
  const query = `
    query GetZoneWebTrafficHourly($zoneTag: String!, $start: DateTime!, $end: DateTime!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1hGroups(
            limit: 100
            filter: { datetime_geq: $start, datetime_lt: $end }
            orderBy: [datetime_ASC]
          ) {
            dimensions {
              datetime
            }
            sum {
              requests
              cachedRequests
              bytes
              cachedBytes
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
      "https://api.cloudflare.com/client/v4/graphql",
      {
        query,
        variables: {
          zoneTag: zoneId,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
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
      return getEmptyWebTraffic();
    }

    const zones = response.data?.data?.viewer?.zones;
    if (!zones || zones.length === 0) {
      return getEmptyWebTraffic();
    }

    const groups = zones[0].httpRequests1hGroups || [];

    let totalRequests = 0,
      cachedRequests = 0,
      totalBytes = 0,
      cachedBytes = 0,
      totalVisitors = 0;
    let maxRequests = 0,
      minRequests = Infinity,
      maxBytes = 0,
      minBytes = Infinity,
      maxVisitors = 0,
      minVisitors = Infinity;

    const timeSeries = groups.map((group) => {
      const requests = group.sum?.requests || 0;
      const cached = group.sum?.cachedRequests || 0;
      const bytes = group.sum?.bytes || 0;
      const cachedB = group.sum?.cachedBytes || 0;
      const visitors = group.uniq?.uniques || 0;

      totalRequests += requests;
      cachedRequests += cached;
      totalBytes += bytes;
      cachedBytes += cachedB;
      totalVisitors += visitors;

      maxRequests = Math.max(maxRequests, requests);
      minRequests = Math.min(minRequests, requests);
      maxBytes = Math.max(maxBytes, bytes);
      minBytes = Math.min(minBytes, bytes);
      maxVisitors = Math.max(maxVisitors, visitors);
      minVisitors = Math.min(minVisitors, visitors);

      return {
        date: group.dimensions?.datetime,
        requests,
        cachedRequests: cached,
        uncachedRequests: requests - cached,
        bytes,
        cachedBytes: cachedB,
        uncachedBytes: bytes - cachedB,
        visitors,
        isHourly: true,
      };
    });

    if (minRequests === Infinity) minRequests = 0;
    if (minBytes === Infinity) minBytes = 0;
    if (minVisitors === Infinity) minVisitors = 0;

    const formatDate = (d) => (d.toISOString().split("T")[0] || "");

    return {
      requests: {
        total: totalRequests,
        cached: cachedRequests,
        uncached: totalRequests - cachedRequests,
        max: maxRequests,
        min: minRequests,
      },
      bandwidth: {
        total: totalBytes,
        cached: cachedBytes,
        uncached: totalBytes - cachedBytes,
        max: maxBytes,
        min: minBytes,
      },
      visitors: {
        total: totalVisitors,
        max: maxVisitors,
        min: minVisitors,
      },
      timeSeries,
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate),
        days: 1,
      },
    };
  } catch (error) {
    console.error(
      "Zone hourly traffic query error:",
      error.response?.data || error.message
    );
    return getEmptyWebTraffic();
  }
}

function getEmptyWebTraffic() {
  return {
    requests: { total: 0, cached: 0, uncached: 0, max: 0, min: 0 },
    bandwidth: { total: 0, cached: 0, uncached: 0, max: 0, min: 0 },
    visitors: { total: 0, max: 0, min: 0 },
    timeSeries: [],
    period: { start: "", end: "", days: 0 },
  };
}

async function getZoneIdByName(zoneName, cfApiToken) {
  const zones = await getZones(cfApiToken);
  const zone = zones.find(
    (z) => z.name === zoneName || z.name.includes(zoneName)
  );
  return zone?.id || null;
}

export default router;
export { getZoneWebTraffic };
