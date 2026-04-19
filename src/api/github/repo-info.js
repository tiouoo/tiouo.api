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
