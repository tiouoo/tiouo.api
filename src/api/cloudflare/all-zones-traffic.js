import express from 'express';
import { getZones } from './zones.js';
import { getZoneWebTraffic } from './zone-traffic.js';
const router = express.Router();

/**
 * @swagger
 * /cloudflare/all-zones-traffic:
 *   get:
 *     summary: 获取所有域名的流量统计
 *     tags: [Cloudflare]
 *     parameters:
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
 *         description: 成功获取所有域名的流量数据
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
 *                       zone:
 *                         type: string
 *                       data:
 *                         type: object
 *       400:
 *         description: 缺少cf_api_token参数
 *       500:
 *         description: 服务器错误
 */
router.get('/all-zones-traffic', async (req, res) => {
  try {
    const cfApiToken = req.query.cf_api_token;
    if (!cfApiToken) {
      return res.status(400).json({ success: false, error: 'Missing cf_api_token parameter' });
    }
    const days = parseInt(req.query.days) || 7;
    const zones = await getZones(cfApiToken);
    const trafficData = await Promise.all(
      zones.map(async (zone) => {
        const data = await getZoneWebTraffic(zone.name, days, cfApiToken);
        return { zone: zone.name, data };
      })
    );
    res.json({ success: true, data: trafficData });
  } catch (error) {
    console.error('Error fetching all zones traffic:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
