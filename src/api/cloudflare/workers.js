import express from 'express';
import axios from 'axios';
const router = express.Router();

/**
 * @swagger
 * /cloudflare/workers:
 *   get:
 *     summary: 获取Cloudflare Workers脚本列表
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
 *     responses:
 *       200:
 *         description: 成功获取Workers脚本列表
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
 *       400:
 *         description: 缺少必填参数
 *       500:
 *         description: 服务器错误
 */
router.get('/workers', async (req, res) => {
  try {
    const cfAccountId = req.query.cf_account_id;
    const cfApiToken = req.query.cf_api_token;
    if (!cfApiToken || !cfAccountId) {
      return res.status(400).json({ success: false, error: 'Missing cf_account_id or cf_api_token parameter' });
    }
    const workers = await getWorkers(cfAccountId, cfApiToken);
    res.json({ success: true, data: workers });
  } catch (error) {
    console.error('Error fetching workers:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function getWorkers(cfAccountId, cfApiToken) {
  try {
    const response = await axios.get(
      `${'https://api.cloudflare.com/client/v4'}/accounts/${cfAccountId}/workers/scripts`,
      {
        headers: {
          Authorization: `Bearer ${cfApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.data.success) {
      console.error('Workers API error:', response.data.errors);
      return [];
    }
    return response.data.result || [];
  } catch (error) {
    console.error('Failed to fetch workers:', error.response?.data || error.message);
    return [];
  }
}

export default router;
