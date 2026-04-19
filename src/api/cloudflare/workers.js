router.get('/workers', async (req, res) => {
  try {
    const cfAccountId = req.query.cf_account_id;
    const cfApiToken = req.query.cf_api_token;
    if (!cfApiToken || !cfAccountId) {
      return res.status(400).json({ success: false, error: 'Missing cf_account_id or cf_api_token parameter' });
    }
    const workers = await getWorkers(cfAccountId, cfApiToken);
    res.json({ success: true, data: workers });
  } catch (error) {
    console.error('Error fetching workers:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
async function getWorkers(cfAccountId, cfApiToken) {
  try {
    const response = await axios.get(
      `${'https://api.cloudflare.com/client/v4'}/accounts/${cfAccountId}/workers/scripts`,
      {
        headers: {
          Authorization: `Bearer ${cfApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!response.data.success) {
      console.error('Workers API error:', response.data.errors);
      return [];
    }
    return response.data.result || [];
  } catch (error) {
    console.error('Failed to fetch workers:', error.response?.data || error.message);
    return [];
  }
}
