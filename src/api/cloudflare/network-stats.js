import express from 'express';
import axios from 'axios';
import { getZones } from './zones.js';
const router = express.Router();

/**
 * @swagger
 * /cloudflare/network-stats:
 *   get:
 *     summary: 获取网络统计数据（HTTP版本、SSL版本、内容类型）
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
 *       - in: query
 *         name: zone
 *         schema:
 *           type: string
 *         description: 域名名称（可选，不填则查询账户级别）
 *     responses:
 *       200:
 *         description: 成功获取网络统计数据
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
 *                     httpVersions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                           requests:
 *                             type: number
 *                     sslVersions:
 *                       type: array
 *                     contentTypes:
 *                       type: array
 *       400:
 *         description: 缺少必填参数
 *       500:
 *         description: 服务器错误
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
    const zoneName = req.query.zone;
    const data = await getNetworkStats(days, zoneName, cfAccountId, cfApiToken);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching network stats:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function getNetworkStats(days = 7, zoneName, cfAccountId, cfApiToken) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d) => d.toISOString().split('T')[0] || '';

  let query;
  let variables;

  let zoneId;
  if (zoneName) {
    zoneId = (await getZoneIdByName(zoneName, cfApiToken)) || '';
  }

  if (zoneId) {
    query = `
      query GetZoneNetworkStats($zoneTag: String!, $start: Date!, $end: Date!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequests1dGroups(
              limit: 100
              filter: { date_geq: $start, date_lt: $end }
            ) {
              sum {
                requests
                clientHTTPVersionMap {
                  clientHTTPProtocol
                  requests
                }
                clientSSLMap {
                  clientSSLProtocol
                  requests
                }
                contentTypeMap {
                  edgeResponseContentTypeName
                  requests
                }
              }
            }
          }
        }
      }
    `;
    variables = {
      zoneTag: zoneId,
      start: formatDate(startDate),
      end: formatDate(now),
    };
  } else {
    query = `
      query GetAccountNetworkStats($accountTag: String!, $start: Date!, $end: Date!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            httpRequests1dGroups(
              limit: 100
              filter: { date_geq: $start, date_lt: $end }
            ) {
              sum {
                requests
                clientHTTPVersionMap {
                  clientHTTPProtocol
                  requests
                }
                clientSSLMap {
                  clientSSLProtocol
                  requests
                }
                contentTypeMap {
                  edgeResponseContentTypeName
                  requests
                }
              }
            }
          }
        }
      }
    `;
    variables = {
      accountTag: cfAccountId,
      start: formatDate(startDate),
      end: formatDate(now),
    };
  }

  try {
    const response = await axios.post(
      'https://api.cloudflare.com/client/v4/graphql',
      {
        query,
        variables,
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
      return { httpVersions: [], sslVersions: [], contentTypes: [] };
    }

    let groups = [];
    if (zoneId) {
      const zones = response.data?.data?.viewer?.zones;
      if (!zones || zones.length === 0) {
        return { httpVersions: [], sslVersions: [], contentTypes: [] };
      }
      groups = zones[0].httpRequests1dGroups || [];
    } else {
      const accounts = response.data?.data?.viewer?.accounts;
      if (!accounts || accounts.length === 0) {
        return { httpVersions: [], sslVersions: [], contentTypes: [] };
      }
      groups = accounts[0].httpRequests1dGroups || [];
    }

    const httpVersionMap = new Map();
    const sslVersionMap = new Map();
    const contentTypeMap = new Map();

    groups.forEach((group) => {
      const httpVersions = group.sum?.clientHTTPVersionMap || [];
      httpVersions.forEach((item) => {
        const protocol = item.clientHTTPProtocol || 'unknown';
        httpVersionMap.set(protocol, (httpVersionMap.get(protocol) || 0) + (item.requests || 0));
      });

      const sslVersions = group.sum?.clientSSLMap || [];
      sslVersions.forEach((item) => {
        const protocol = item.clientSSLProtocol || 'unknown';
        sslVersionMap.set(protocol, (sslVersionMap.get(protocol) || 0) + (item.requests || 0));
      });

      const contentTypes = group.sum?.contentTypeMap || [];
      contentTypes.forEach((item) => {
        const type = item.edgeResponseContentTypeName || 'unknown';
        contentTypeMap.set(type, (contentTypeMap.get(type) || 0) + (item.requests || 0));
      });
    });

    const httpVersions = Array.from(httpVersionMap.entries())
      .map(([name, requests]) => ({ name, requests }))
      .sort((a, b) => b.requests - a.requests);

    const sslVersions = Array.from(sslVersionMap.entries())
      .map(([name, requests]) => ({ name, requests }))
      .sort((a, b) => b.requests - a.requests);

    const contentTypes = Array.from(contentTypeMap.entries())
      .map(([name, requests]) => ({ name, requests }))
      .sort((a, b) => b.requests - a.requests);

    return { httpVersions, sslVersions, contentTypes };
  } catch (error) {
    console.error('Network stats query error:', error.response?.data || error.message);
    return { httpVersions: [], sslVersions: [], contentTypes: [] };
  }
}

async function getZoneIdByName(zoneName, cfApiToken) {
  const zones = await getZones(cfApiToken);
  const zone = zones.find((z) => z.name === zoneName || z.name.includes(zoneName));
  return zone?.id || null;
}

export default router;
