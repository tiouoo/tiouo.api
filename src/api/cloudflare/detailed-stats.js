router.get('/detailed-stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const zoneName = req.query.zone;
    const data = await getDetailedStats(days, zoneName);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching detailed stats:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
