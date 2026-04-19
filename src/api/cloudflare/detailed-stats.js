// 获取详细统计数据（安全性、缓存、错误）
const { getZones } = require('./zones');

async function getDetailedStats(days = 7, zoneName, cfAccountId, cfApiToken) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - days);

  const formatDate = (d) => (d.toISOString().split("T")[0] || "");

  try {
    let zoneId;
    if (zoneName) {
      zoneId = await getZoneIdByName(zoneName, cfApiToken);
    }

    const [current, prev] = await Promise.all([
      queryDetailedStats(formatDate(startDate), formatDate(now), zoneId || '', cfAccountId, cfApiToken),
      queryDetailedStats(formatDate(prevStartDate), formatDate(startDate), zoneId || '', cfAccountId, cfApiToken),
    ]);

    const calcChange = (curr, previous) => {
      if (previous === 0) return curr > 0 ? 100 : 0;
      return ((curr - previous) / previous) * 100;
    };

    return {
      security: {
        encryptedRequests: {
          value: current.encryptedRequests,
          change: calcChange(current.encryptedRequests, prev.encryptedRequests),
        },
        encryptedRequestsRate: {
          value:
            current.requests > 0
              ? (current.encryptedRequests / current.requests) * 100
              : 0,
          change: calcChange(
            current.requests > 0
              ? current.encryptedRequests / current.requests
              : 0,
            prev.requests > 0 ? prev.encryptedRequests / prev.requests : 0
          ),
        },
        encryptedBytes: {
          value: current.encryptedBytes,
          change: calcChange(current.encryptedBytes, prev.encryptedBytes),
        },
        encryptedBytesRate: {
          value:
            current.bytes > 0
              ? (current.encryptedBytes / current.bytes) * 100
              : 0,
          change: calcChange(
            current.bytes > 0 ? current.encryptedBytes / current.bytes : 0,
            prev.bytes > 0 ? prev.encryptedBytes / prev.bytes : 0
          ),
        },
      },
      cache: {
        cachedRequests: {
          value: current.cachedRequests,
          change: calcChange(current.cachedRequests, prev.cachedRequests),
        },
        cachedRequestsRate: {
          value:
            current.requests > 0
              ? (current.cachedRequests / current.requests) * 100
              : 0,
          change: calcChange(
            current.requests > 0
              ? current.cachedRequests / current.requests
              : 0,
            prev.requests > 0 ? prev.cachedRequests / prev.requests : 0
          ),
        },
        cachedBytes: {
          value: current.cachedBytes,
          change: calcChange(current.cachedBytes, prev.cachedBytes),
        },
        cachedBytesRate: {
          value:
            current.bytes > 0 ? (current.cachedBytes / current.bytes) * 100 : 0,
          change: calcChange(
            current.bytes > 0 ? current.cachedBytes / current.bytes : 0,
            prev.bytes > 0 ? prev.cachedBytes / prev.bytes : 0
          ),
        },
      },
      errors: {
        status4xx: {
          value: current.status4xx,
          change: calcChange(current.status4xx, prev.status4xx),
        },
        status4xxRate: {
          value:
            current.requests > 0
              ? (current.status4xx / current.requests) * 100
              : 0,
          change: calcChange(
            current.requests > 0 ? current.status4xx / current.requests : 0,
            prev.requests > 0 ? prev.status4xx / prev.requests : 0
          ),
        },
        status5xx: {
          value: current.status5xx,
          change: calcChange(current.status5xx, prev.status5xx),
        },
        status5xxRate: {
          value:
            current.requests > 0
              ? (current.status5xx / current.requests) * 100
              : 0,
          change: calcChange(
            current.requests > 0 ? current.status5xx / current.requests : 0,
            prev.requests > 0 ? prev.status5xx / prev.requests : 0
          ),
        },
      },
    };
  } catch (error) {
    console.error("Error in getDetailedStats:", error.message);
    return { error: error.message, security: { encryptedRequests: { value: 0, change: 0 }, encryptedRequestsRate: { value: 0, change: 0 }, encryptedBytes: { value: 0, change: 0 }, encryptedBytesRate: { value: 0, change: 0 } }, cache: { cachedRequests: { value: 0, change: 0 }, cachedRequestsRate: { value: 0, change: 0 }, cachedBytes: { value: 0, change: 0 }, cachedBytesRate: { value: 0, change: 0 } }, errors: { status4xx: { value: 0, change: 0 }, status4xxRate: { value: 0, change: 0 }, status5xx: { value: 0, change: 0 }, status5xxRate: { value: 0, change: 0 } } };
  }
}

// 查询详细统计数据
async function queryDetailedStats(startDate, endDate, zoneTag, cfAccountId, cfApiToken) {
  let query;
  let variables;

  if (zoneTag) {
    // 查询特定域名的详细统计数据
    query = `
      query GetZoneDetailedStats($zoneTag: String!, $start: Date!, $end: Date!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequests1dGroups(
              limit: 100
              filter: { date_geq: $start, date_lt: $end }
            ) {
              sum {
                requests
                bytes
                cachedRequests
                cachedBytes
                encryptedRequests
                encryptedBytes
                responseStatusMap {
                  edgeResponseStatus
                  requests
                }
              }
            }
          }
        }
      }
    `;
    variables = {
      zoneTag,
      start: startDate,
      end: endDate,
    };
  } else {
    // 查询账户级别的详细统计数据
    query = `
      query GetAccountDetailedStats($accountTag: String!, $start: Date!, $end: Date!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            httpRequests1dGroups(
              limit: 100
              filter: { date_geq: $start, date_lt: $end }
            ) {
              sum {
                requests
                bytes
                cachedRequests
                cachedBytes
                encryptedRequests
                encryptedBytes
                responseStatusMap {
                  edgeResponseStatus
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
      start: startDate,
      end: endDate,
    };
  }

  try {
    const response = await axios.post(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        query,
        variables,
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
      return getEmptyDetailedStats();
    }

    let groups = [];
    if (zoneTag) {
      const zones = response.data?.data?.viewer?.zones;
      if (!zones || zones.length === 0) {
        return getEmptyDetailedStats();
      }
      groups = zones[0].httpRequests1dGroups || [];
    } else {
      const accounts = response.data?.data?.viewer?.accounts;
      if (!accounts || accounts.length === 0) {
        return getEmptyDetailedStats();
      }
      groups = accounts[0].httpRequests1dGroups || [];
    }

    const result = getEmptyDetailedStats();

    groups.forEach((group) => {
      result.requests += group.sum?.requests || 0;
      result.bytes += group.sum?.bytes || 0;
      result.cachedRequests += group.sum?.cachedRequests || 0;
      result.cachedBytes += group.sum?.cachedBytes || 0;
      result.encryptedRequests += group.sum?.encryptedRequests || 0;
      result.encryptedBytes += group.sum?.encryptedBytes || 0;

      const statusMap = group.sum?.responseStatusMap || [];
      statusMap.forEach((status) => {
        const code = status.edgeResponseStatus;
        if (code >= 400 && code < 500) {
          result.status4xx += status.requests || 0;
        } else if (code >= 500 && code < 600) {
          result.status5xx += status.requests || 0;
        }
      });
    });

    return result;
  } catch (error) {
    console.error(
      "Detailed stats query error:",
      error.response?.data || error.message
    );
    return getEmptyDetailedStats();
  }
}

function getEmptyDetailedStats() {
  return {
    requests: 0,
    bytes: 0,
    cachedRequests: 0,
    cachedBytes: 0,
    encryptedRequests: 0,
    encryptedBytes: 0,
    status4xx: 0,
    status5xx: 0,
  };
}

// 获取指定域名的 Zone ID
async function getZoneIdByName(zoneName, cfApiToken) {
  const zones = await getZones(cfApiToken);
  const zone = zones.find(
    (z) => z.name === zoneName || z.name.includes(zoneName)
  );
  return zone?.id || null;
}

router.get('/detailed-stats', async (req, res) => {
  try {
    const cfAccountId = req.query.cf_account_id;
    const cfApiToken = req.query.cf_api_token;
    if (!cfApiToken || !cfAccountId) {
      return res.status(400).json({ success: false, error: 'Missing cf_account_id or cf_api_token parameter' });
    }
    const days = parseInt(req.query.days) || 7;
    const zoneName = req.query.zone;
    const data = await getDetailedStats(days, zoneName, cfAccountId, cfApiToken);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching detailed stats:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
