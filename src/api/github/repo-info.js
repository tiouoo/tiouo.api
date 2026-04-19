import express from 'express';
import axios from 'axios';
const router = express.Router();

/**
 * @swagger
 * /github/repo-info:
 *   get:
 *     summary: 获取GitHub仓库信息
 *     tags: [GitHub]
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: GitHub Personal Access Token
 *       - in: query
 *         name: repo
 *         schema:
 *           type: string
 *         required: true
 *         description: 仓库路径（格式：owner/repo）
 *     responses:
 *       200:
 *         description: 成功获取仓库信息
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
 *                     name:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     defaultBranch:
 *                       type: string
 *                     private:
 *                       type: boolean
 *       400:
 *         description: 缺少必填参数
 *       404:
 *         description: 仓库不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/repo-info', async (req, res) => {
  try {
    const { token, repo } = req.query;

    if (!token || !repo) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数',
      });
    }

    const response = await axios.get(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    res.json({
      success: true,
      data: {
        name: response.data.name,
        fullName: response.data.full_name,
        defaultBranch: response.data.default_branch,
        private: response.data.private,
      },
    });
  } catch (error) {
    console.error('GitHub repo info error:', error.response?.data || error.message);

    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || '获取仓库信息失败',
    });
  }
});

export default router;
