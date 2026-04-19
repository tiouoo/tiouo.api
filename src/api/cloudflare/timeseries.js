/**
 * @swagger
 * /cloudflare/timeseries:
 *   get:
 *     summary: 获取请求时间序列数据（用于折线图）
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
 *         description: 成功获取时间序列数据
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
 *                       date:
 *                         type: string
 *                       requests:
 *                         type: number
 *                       bytes:
 *                         type: number
 *                       pageViews:
 *                         type: number
 *                       visits:
 *                         type: number
 *                       isHourly:
 *                         type: boolean
 *       400:
 *         description: 缺少必填参数
 *       500:
 *         description: 服务器错误
 */
// 获取请求时间序列数据（用于折线图）
async function getRequestsTimeSeries(days = 7, cfAccountId, cfApiToken) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d) => (d.toISOString().split("T")[0] || "");

  if (days <= 1) {
    return await getHourlyTimeSeries(startDate, now, cfAccountId, cfApiToken);
  }

  const query = `
    query GetRequestsTimeSeries($accountTag: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
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
    return groups.map((group) => ({
      date: group.dimensions?.date,
      requests: group.sum?.requests || 0,
      bytes: group.sum?.bytes || 0,
      pageViews: group.sum?.pageViews || 0,
      visits: group.uniq?.uniques || 0,
      isHourly: false,
    }));
  } catch (error) {
    console.error(
      "Time series query error:",
      error.response?.data || error.message
    );
    return [];
  }
}

// 获取小时级别时间序列数据
async function getHourlyTimeSeries(startDate, endDate, cfAccountId, cfApiToken) {
  const query = `
    query GetHourlyTimeSeries($accountTag: String!, $start: DateTime!, $end: DateTime!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
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
      "https://api.cloudflare.com/client/v4/graphql",
      {
        query,
        variables: {
          accountTag: cfAccountId,
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
      return [];
    }

    const accounts = response.data?.data?.viewer?.accounts;
    if (!accounts || accounts.length === 0) {
      return [];
    }

    const groups = accounts[0].httpRequests1hGroups || [];
    return groups.map((group) => ({
      date: group.dimensions?.datetime,
      requests: group.sum?.requests || 0,
      bytes: group.sum?.bytes || 0,
      pageViews: group.sum?.pageViews || 0,
      visits: group.uniq?.uniques || 0,
      isHourly: true,
    }));
  } catch (error) {
    console.error(
      "Hourly time series query error:",
      error.response?.data || error.message
    );
    return [];
  }
}

router.get('/timeseries', async (req, res) => {
  try {
    const cfAccountId = req.query.cf_account_id;
    const cfApiToken = req.query.cf_api_token;
    if (!cfApiToken || !cfAccountId) {
      return res.status(400).json({ success: false, error: 'Missing cf_account_id or cf_api_token parameter' });
    }
    const days = parseInt(req.query.days) || 7;
    const data = await getRequestsTimeSeries(days, cfAccountId, cfApiToken);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching time series:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
