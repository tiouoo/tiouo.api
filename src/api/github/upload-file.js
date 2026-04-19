import express from 'express';
import axios from 'axios';
const router = express.Router();

/**
 * @swagger
 * /github/upload-file:
 *   post:
 *     summary: 上传文件到GitHub仓库
 *     tags: [GitHub]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - repo
 *               - path
 *               - content
 *             properties:
 *               token:
 *                 type: string
 *                 description: GitHub Personal Access Token
 *               repo:
 *                 type: string
 *                 description: 仓库路径（格式：owner/repo）
 *               branch:
 *                 type: string
 *                 description: 分支名称（可选，默认为仓库默认分支）
 *               path:
 *                 type: string
 *                 description: 文件路径
 *               message:
 *                 type: string
 *                 description: 提交信息
 *               content:
 *                 type: string
 *                 description: 文件内容（Base64编码）
 *     responses:
 *       200:
 *         description: 上传成功
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
 *                     url:
 *                       type: string
 *                     rawUrl:
 *                       type: string
 *                     path:
 *                       type: string
 *                     sha:
 *                       type: string
 *       400:
 *         description: 缺少必填参数
 *       401:
 *         description: Token无效或已过期
 *       404:
 *         description: 仓库不存在或无权访问
 *       422:
 *         description: 文件路径或内容格式错误
 *       500:
 *         description: 服务器错误
 */
router.post('/upload-file', async (req, res) => {
  try {
    const { token, repo, branch, path, message, content } = req.body;

    if (!token || !repo || !path || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数',
      });
    }

    let sha;
    try {
      const checkResponse = await axios.get(
        `https://api.github.com/repos/${repo}/contents/${path}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
          params: {
            ref: branch,
          },
        }
      );

      if (checkResponse.data && checkResponse.data.sha) {
        sha = checkResponse.data.sha;
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }

    const uploadResponse = await axios.put(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        message: message || `Upload ${path}`,
        content,
        branch,
        ...(sha && { sha }),
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    const githubUrl = uploadResponse.data.content.html_url;
    const rawUrl = uploadResponse.data.content.download_url;

    res.json({
      success: true,
      data: {
        url: githubUrl,
        rawUrl,
        path,
        sha: uploadResponse.data.content.sha,
      },
    });
  } catch (error) {
    console.error('GitHub upload error:', error.response?.data || error.message);

    let errorMessage = '上传失败';
    if (error.response?.status === 401) {
      errorMessage = 'GitHub Token 无效或已过期';
    } else if (error.response?.status === 404) {
      errorMessage = '仓库不存在或无权访问';
    } else if (error.response?.status === 422) {
      errorMessage = '文件路径或内容格式错误';
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }

    res.status(error.response?.status || 500).json({
      success: false,
      error: errorMessage,
    });
  }
});

export default router;
