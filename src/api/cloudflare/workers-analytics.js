/**
 * @swagger
 * /cloudflare/workers-analytics:
 *   get:
 *     summary: 获取Cloudflare Workers分析数据
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
 *         description: 成功获取Workers分析数据
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
 *                     workers:
 *                       type: array
 *       400:
 *         description: 缺少必填参数
 *       500:
 *         description: 服务器错误
 */
router.get('/workers-analytics', async (req, res) => {
  try {
    const cfAccountId = req.query.cf_account_id;
    const cfApiToken = req.query.cf_api_token;
    if (!cfApiToken || !cfAccountId) {
      return res.status(400).json({ success: false, error: 'Missing cf_account_id or cf_api_token parameter' });
    }
    const days = parseInt(req.query.days) || 7;
    const data = await getWorkersAnalytics(days, cfAccountId, cfApiToken);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching workers analytics:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
async function getWorkersAnalytics(days = 7, cfAccountId, cfApiToken) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d) => d.toISOString();

  const query = `
    query GetWorkersAnalytics($accountTag: String!, $datetimeStart: String!, $datetimeEnd: String!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            limit: 1000
            filter: {
              datetime_geq: $datetimeStart,
              datetime_lt: $datetimeEnd
            }
            orderBy: [scriptName_ASC, datetime_ASC]
          ) {
            sum {
              subrequests
              requests
              errors
            }
            quantiles {
              cpuTimeP50
              cpuTimeP99
            }
            dimensions{
              datetime
              scriptName
              status
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
          datetimeStart: formatDate(startDate),
          datetimeEnd: formatDate(now),
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
      return { workers: [] };
    }

    const accounts = response.data?.data?.viewer?.accounts;
    if (!accounts || accounts.length === 0) {
      return { workers: [] };
    }

    const invocations = accounts[0].workersInvocationsAdaptive || [];

    // 按 Worker 名称分组
    const workerMap = new Map();
    invocations.forEach((invocation) => {
      const scriptName = invocation.dimensions?.scriptName || 'unknown';
      if (!workerMap.has(scriptName)) {
        workerMap.set(scriptName, []);
      }
      workerMap.get(scriptName)?.push({
        scriptName,
        requests: invocation.sum?.requests || 0,
        errors: invocation.sum?.errors || 0,
        subrequests: invocation.sum?.subrequests || 0,
        cpuTimeP50: invocation.quantiles?.cpuTimeP50 || 0,
        cpuTimeP99: invocation.quantiles?.cpuTimeP99 || 0,
        status: invocation.dimensions?.status || 'unknown',
        datetime: invocation.dimensions?.datetime || '',
      });
    });

    // 转换为结果格式
    const workers = Array.from(workerMap.entries()).map(([name, timeSeries]) => {
      // 计算总和
      let totalRequests = 0;
      let totalErrors = 0;
      let totalSubrequests = 0;
      let totalCpuTimeP50 = 0;
      let totalCpuTimeP99 = 0;

      timeSeries.forEach((item) => {
        totalRequests += item.requests;
        totalErrors += item.errors;
        totalSubrequests += item.subrequests;
        totalCpuTimeP50 += item.cpuTimeP50;
        totalCpuTimeP99 += item.cpuTimeP99;
      });

      const avgCpuTimeP50 = timeSeries.length > 0 ? totalCpuTimeP50 / timeSeries.length : 0;
      const avgCpuTimeP99 = timeSeries.length > 0 ? totalCpuTimeP99 / timeSeries.length : 0;

      return {
        name,
        data: {
          requests: totalRequests,
          errors: totalErrors,
          subrequests: totalSubrequests,
          cpuTimeP50: avgCpuTimeP50,
          cpuTimeP99: avgCpuTimeP99,
          timeSeries,
          period: {
            start: formatDate(startDate).split('T')[0],
            end: formatDate(now).split('T')[0],
            days,
          },
        },
      };
    });

    return { workers };
  } catch (error) {
    console.error('Workers analytics query error:', error.response?.data || error.message);
    return { workers: [] };
  }
}
