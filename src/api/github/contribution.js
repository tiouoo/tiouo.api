/**
 * @swagger
 * tags:
 *   name: GitHub
 *   description: GitHub数据相关API
 * /github/contribution:
 *   get:
 *     summary: 获取GitHub用户的贡献日历数据
 *     tags: [GitHub]
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         required: true
 *         description: GitHub用户名
 *       - in: query
 *         name: year
 *         schema:
 *           type: number
 *           default: -1
 *         description: 指定年份的贡献数据，-1表示所有年份
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 0
 *         description: 限制返回的贡献数据数量
 *     responses:
 *       200:
 *         description: 成功获取贡献数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: number
 *                   example: 1234
 *                 contributions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       count:
 *                         type: number
 *                       intensity:
 *                         type: number
 *       400:
 *         description: 缺少用户名参数
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error: Missing username"
 *       404:
 *         description: 用户不存在或无贡献数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error: User does not exist"
 *       500:
 *         description: 内部服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Error: Internal server error"
 */
router.get('/contribution', async (req, res) => {
  try {
    const username = req.query.username;
    const year = Number(req.query.year ?? -1);
    const limit = Number(req.query.limit ?? 0);

    if (!username) {
      return res.status(400).json({ error: 'Error: Missing username' });
    }

    const userData = await getGithubContributions(username, year, limit);

    if (!userData.total && !userData.contributions) {
      return res.status(404).json({ error: 'Error: User does not exist' });
    }

    return res.status(200).json(userData);
  } catch (error) {
    console.error('Error fetching GitHub contribution data:', error);
    return res.status(500).json({ error: 'Error: Internal server error' });
  }
});
