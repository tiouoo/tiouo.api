/**
 * @swagger
 * /cloudflare/verify:
 *   post:
 *     summary: 验证Cloudflare API Token
 *     tags: [Cloudflare]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Cloudflare API Token
 *     responses:
 *       200:
 *         description: Token验证成功
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
 *         description: 缺少token参数
 *       500:
 *         description: 服务器错误
 */
// 验证 Token
router.get('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数',
      });
    }
    const response = await axios.get('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    res.json({ success: true, data: response.data });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.response?.data || error.message,
    });
  }
});
