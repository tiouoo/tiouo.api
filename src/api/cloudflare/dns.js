router.post('/dns/cname', async (req, res) => {
  try {
    const { apiToken, zoneId, name, content, proxied = false } = req.body;

    // 验证必填参数
    if (!apiToken || !zoneId || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必填参数: apiToken, zoneId, content',
      });
    }

    // 调用 Cloudflare API
    const response = await axios.post(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
      {
        type: 'CNAME',
        name: name || '@',
        content: content,
        ttl: 1, // 自动
        proxied: proxied,
      },
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // 返回结果
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
