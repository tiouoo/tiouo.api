router.get('/timeseries', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const data = await getRequestsTimeSeries(days);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching time series:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
