router.get('/workers', async (req, res) => {
  try {
    const workers = await getWorkers();
    res.json({ success: true, data: workers });
  } catch (error) {
    console.error('Error fetching workers:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});
async function getWorkers(): Promise<Worker[]> {
  try {
    const response = await axios.get(`${"https://api.cloudflare.com/client/v4"}/accounts/${CF_ACCOUNT_ID}/workers/scripts`, {
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.data.success) {
      console.error("Workers API error:", response.data.errors);
      return [];
    }
    return response.data.result || [];
  } catch (error) {
    console.error(
      "Failed to fetch workers:",
      error.response?.data || error.message
    );
    return [];
  }