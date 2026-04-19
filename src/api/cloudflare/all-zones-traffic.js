const { getZoneWebTraffic } = require('./zone-traffic');
const { getZones } = require('./zones');

router.get('/all-zones-traffic', async (req, res) => {
  try {
    const cfApiToken = req.query.cf_api_token;
    if (!cfApiToken) {
      return res.status(400).json({ success: false, error: 'Missing cf_api_token parameter' });
    }
    const days = parseInt(req.query.days) || 7;
    const zones = await getZones(cfApiToken);
    const trafficData = await Promise.all(
      zones.map(async (zone) => {
        const data = await getZoneWebTraffic(zone.name, days, cfApiToken);
        return { zone: zone.name, data };
      })
    );
    res.json({ success: true, data: trafficData });
  } catch (error) {
    console.error('Error fetching all zones traffic:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
