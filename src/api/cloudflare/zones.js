router.get('/zones', async (req, res) => {
  try {
    const zones = await getZones();
    res.json({ success: true, data: zones });
  } catch (error) {
    console.error('Error fetching Cloudflare zones:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
async function getZones(): Promise<Zone[]> {
  try {
    const response = await axios.get(`${"https://api.cloudflare.com/client/v4"}/zones`, {
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.data.success) {
      console.error("Zones API error:", response.data.errors);
      return [];
    }
    return response.data.result || [];
  } catch (error) {
    console.error(
      "Failed to fetch zones:",
      error.response?.data || error.message
    );
    return [];
  }
}