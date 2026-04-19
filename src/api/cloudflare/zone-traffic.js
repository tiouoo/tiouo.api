router.get('/zone-traffic', async (req, res) => {
  try {
    const zoneName = req.query.zone || 'yik.at';
    const days = parseInt(req.query.days) || 7;
    const data = await getZoneWebTraffic(zoneName, days);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching zone traffic:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
