import express from 'express';
import axios from 'axios';
const router = express.Router();

/**
 * @swagger
 * /cloudflare/dns/cname:
 *   post:
 *     summary: 添加CNAME记录
 *     tags: [Cloudflare]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - apiToken
 *               - zoneId
 *               - content
 *             properties:
 *               apiToken:
 *                 type: string
 *                 description: Cloudflare API Token
 *               zoneId:
 *                 type: string
 *                 description: 域名区域ID
 *               name:
 *                 type: string
 *                 description: 记录名称（默认为@）
 *               content:
 *                 type: string
 *                 description: CNAME记录值
 *               proxied:
 *                 type: boolean
 *                 default: false
 *                 description: 是否启用Cloudflare代理
 *     responses:
 *       200:
 *         description: 添加成功
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
 *       400:
 *         description: 缺少必填参数
 *       500:
 *         description: 服务器错误
 */
router.post('/cname', async (req, res) => {
  try {
    const { apiToken, zoneId, name, content, proxied = false } = req.body;

    if (!apiToken || !zoneId || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: apiToken, zoneId, content',
      });
    }

    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
      {
        type: 'CNAME',
        name: name || '@',
        content,
        ttl: 1,
        proxied,
      },
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.success) {
      res.json({
        success: true,
        data: response.data.result,
      });
    } else {
      res.status(400).json({
        success: false,
        error: response.data.errors?.[0]?.message || '添加失败',
        errors: response.data.errors,
      });
    }
  } catch (error) {
    console.error('Cloudflare API Error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.errors?.[0]?.message || error.message || '服务器错误',
    });
  }
});

export default router;
