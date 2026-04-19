/**
 * @swagger
 * /cloudflare/zones:
 *   get:
 *     summary: 获取所有Cloudflare域名
 *     tags: [Cloudflare]
 *     parameters:
 *       - in: query
 *         name: cf_api_token
 *         schema:
 *           type: string
 *         required: true
 *         description: Cloudflare API Token
 *     responses:
 *       200:
 *         description: 成功获取域名列表
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
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       status:
 *                         type: string
 *       400:
 *         description: 缺少cf_api_token参数
 *       500:
 *         description: 服务器错误
 */
// 获取所有 Cloudflare 域名
async function getZones(cfApiToken) {
  try {
    const response = await axios.get(`${"https://api.cloudflare.com/client/v4"}/zones`, {
      headers: {
        Authorization: `Bearer ${cfApiToken}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.data.success) {
      console.error("Zones API error:", response.data.errors);
      return [];
    }
    return response.data.result || [];
  } catch (error) {
    console.error(
      "Failed to fetch zones:",
      error.response?.data || error.message
    );
    return [];
  }
}

router.get('/zones', async (req, res) => {
  try {
    const cfApiToken = req.query.cf_api_token;
    if (!cfApiToken) {
      return res.status(400).json({ success: false, error: 'Missing cf_api_token parameter' });
    }
    const zones = await getZones(cfApiToken);
    res.json({ success: true, data: zones });
  } catch (error) {
    console.error('Error fetching Cloudflare zones:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});