router.get('/analytics', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const data = await getAccountAnalytics(days);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching Cloudflare analytics:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function getAccountAnalytics(days: number = 7): Promise<AccountAnalytics> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - days);

  const formatDate = (d: Date): string => (d.toISOString().split("T")[0] || "");

  try {
    const [current, prev] = await Promise.all([
      queryAccountAnalytics(formatDate(startDate), formatDate(now)),
      queryAccountAnalytics(formatDate(prevStartDate), formatDate(startDate)),
    ]);

    const calcChange = (curr: number, previous: number): number => {
      if (previous === 0) return curr > 0 ? 100 : 0;
      return ((curr - previous) / previous) * 100;
    };

    return {
      requests: {
        value: current.requests,
        change: calcChange(current.requests, prev.requests),
      },
      bandwidth: {
        value: current.bandwidth,
        change: calcChange(current.bandwidth, prev.bandwidth),
      },
      visits: {
        value: current.visits,
        change: calcChange(current.visits, prev.visits),
      },
      pageViews: {
        value: current.pageViews,
        change: calcChange(current.pageViews, prev.pageViews),
      },
      period: {
        start: formatDate(startDate),
        end: formatDate(now),
        days: days,
      },
    };
  } catch (error) {
    console.error("Error in getAccountAnalytics:", error.message);
    return { error: error.message, requests: { value: 0, change: 0 }, bandwidth: { value: 0, change: 0 }, visits: { value: 0, change: 0 }, pageViews: { value: 0, change: 0 }, period: { start: '', end: '', days: 0 } };
  }
}
