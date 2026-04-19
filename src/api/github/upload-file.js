router.post('/upload-file', async (req, res) => {
  try {
    const { token, repo, branch, path, message, content } = req.body;

    // 验证必填字段
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
      // 文件不存在，继续创建
      if (error.response?.status !== 404) {
        throw error;
      }
    }

    // 上传文件到 GitHub
    const uploadResponse = await axios.put(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        message: message || `Upload ${path}`,
        content,
        branch,
        ...(sha && { sha }), // 如果文件存在，需要提供 sha 来更新
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
