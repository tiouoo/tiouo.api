router.get('/countries', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const data = await getCountryAnalytics(days);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching country analytics:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
