/**
 * @swagger
 * tags:
 *   name: Health
 *   description: 健康检查API
 * /health:
 *   get:
 *     summary: 检查API服务的健康状态
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API服务健康
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: unhealthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2023-10-27T10:00:00.000Z
 */
router.get('/', async (_req, res) => {
  res.json({
    status: 'unhealthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
