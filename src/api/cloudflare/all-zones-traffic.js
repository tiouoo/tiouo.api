router.get('/all-zones-traffic', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const zones = await getZones();
    const trafficData = await Promise.all(
      zones.map(async (zone) => {
        const data = await getZoneWebTraffic(zone.name, days);
        return { zone: zone.name, data };
      })
    );
    res.json({ success: true, data: trafficData });
  } catch (error) {
    console.error('Error fetching all zones traffic:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
async function getZones() {
  try {
    const response = await axios.get(`${'https://api.cloudflare.com/client/v4'}/zones`, {
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.data.success) {
      console.error('Zones API error:', response.data.errors);
      return [];
    }
    return response.data.result || [];
  } catch (error) {
    console.error('Failed to fetch zones:', error.response?.data || error.message);
    return [];
  }
}
