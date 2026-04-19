
// 使用 GraphQL 查询账户级别分析数据
async function queryAccountAnalytics(startDate: string, endDate: string): Promise<AccountAnalyticsResult> {
  const query = `
    query GetAccountAnalytics($accountTag: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          httpRequests1dGroups(
            limit: 100
            filter: { date_geq: $start, date_lt: $end }
          ) {
            sum {
              requests
              bytes
              pageViews
            }
            uniq {
              uniques
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        query,
        variables: {
          accountTag: CF_ACCOUNT_ID,
          start: startDate,
          end: endDate,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errors) {
      console.error("GraphQL errors:", response.data.errors);
      return { requests: 0, bandwidth: 0, visits: 0, pageViews: 0 };
    }

    const accounts = response.data?.data?.viewer?.accounts;
    if (!accounts || accounts.length === 0) {
      return await queryZonesAnalytics(startDate, endDate);
    }

    const groups = accounts[0].httpRequests1dGroups || [];
    let requests = 0,
      bandwidth = 0,
      visits = 0,
      pageViews = 0;

    groups.forEach((group) => {
      requests += group.sum?.requests || 0;
      bandwidth += group.sum?.bytes || 0;
      pageViews += group.sum?.pageViews || 0;
      visits += group.uniq?.uniques || 0;
    });

    return { requests, bandwidth, visits, pageViews };
  } catch (error) {
    console.error(
      "GraphQL query error:",
      error.response?.data || error.message
    );
    return { requests: 0, bandwidth: 0, visits: 0, pageViews: 0 };
  }
}

// 备用：通过 zones 查询分析数据
async function queryZonesAnalytics(startDate: string, endDate: string): Promise<AccountAnalyticsResult> {
  const zones = await getZones();
  if (zones.length === 0) {
    return { requests: 0, bandwidth: 0, visits: 0, pageViews: 0 };
  }

  const query = `
    query GetZoneAnalytics($zoneTag: String!, $start: Date!, $end: Date!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 100
            filter: { date_geq: $start, date_lt: $end }
          ) {
            sum {
              requests
              bytes
              pageViews
            }
            uniq {
              uniques
            }
          }
        }
      }
    }
  `;

  const results = await Promise.all(
    zones.map(async (zone) => {
      try {
        const response = await axios.post(
          "https://api.cloudflare.com/client/v4/graphql",
          {
            query,
            variables: {
              zoneTag: zone.id,
              start: startDate,
              end: endDate,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${CF_API_TOKEN}`,
              "Content-Type": "application/json",
            },
          }
        );

        const zoneData = response.data?.data?.viewer?.zones?.[0];
        const groups = zoneData?.httpRequests1dGroups || [];
        let requests = 0,
          bandwidth = 0,
          visits = 0,
          pageViews = 0;

        groups.forEach((group) => {
          requests += group.sum?.requests || 0;
          bandwidth += group.sum?.bytes || 0;
          pageViews += group.sum?.pageViews || 0;
          visits += group.uniq?.uniques || 0;
        });

        return { requests, bandwidth, visits, pageViews };
      } catch (error) {
        return { requests: 0, bandwidth: 0, visits: 0, pageViews: 0 };
      }
    })
  );

  return results.reduce(
    (acc, curr) => ({
      requests: acc.requests + curr.requests,
      bandwidth: acc.bandwidth + curr.bandwidth,
      visits: acc.visits + curr.visits,
      pageViews: acc.pageViews + curr.pageViews,
    }),
    { requests: 0, bandwidth: 0, visits: 0, pageViews: 0 }
  );
}

// 获取请求时间序列数据（用于折线图）
export async function getRequestsTimeSeries(days: number = 7): Promise<TimeSeriesData[]> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d: Date): string => (d.toISOString().split("T")[0] || "");

  // 如果是24小时内，使用小时级别数据
  if (days <= 1) {
    return await getHourlyTimeSeries(startDate, now);
  }

  const query = `
    query GetRequestsTimeSeries($accountTag: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          httpRequests1dGroups(
            limit: 100
            filter: { date_geq: $start, date_lt: $end }
            orderBy: [date_ASC]
          ) {
            dimensions {
              date
            }
            sum {
              requests
              bytes
              pageViews
            }
            uniq {
              uniques
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        query,
        variables: {
          accountTag: CF_ACCOUNT_ID,
          start: formatDate(startDate),
          end: formatDate(now),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errors) {
      console.error("GraphQL errors:", response.data.errors);
      return [];
    }

    const accounts = response.data?.data?.viewer?.accounts;
    if (!accounts || accounts.length === 0) {
      return [];
    }

    const groups = accounts[0].httpRequests1dGroups || [];
    return groups.map((group) => ({
      date: group.dimensions?.date,
      requests: group.sum?.requests || 0,
      bytes: group.sum?.bytes || 0,
      pageViews: group.sum?.pageViews || 0,
      visits: group.uniq?.uniques || 0,
      isHourly: false,
    }));
  } catch (error) {
    console.error(
      "Time series query error:",
      error.response?.data || error.message
    );
    return [];
  }
}

// 获取小时级别时间序列数据
async function getHourlyTimeSeries(startDate: Date, endDate: Date): Promise<TimeSeriesData[]> {
  const query = `
    query GetHourlyTimeSeries($accountTag: String!, $start: DateTime!, $end: DateTime!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          httpRequests1hGroups(
            limit: 100
            filter: { datetime_geq: $start, datetime_lt: $end }
            orderBy: [datetime_ASC]
          ) {
            dimensions {
              datetime
            }
            sum {
              requests
              bytes
              pageViews
            }
            uniq {
              uniques
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        query,
        variables: {
          accountTag: CF_ACCOUNT_ID,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errors) {
      console.error("GraphQL errors:", response.data.errors);
      return [];
    }

    const accounts = response.data?.data?.viewer?.accounts;
    if (!accounts || accounts.length === 0) {
      return [];
    }

    const groups = accounts[0].httpRequests1hGroups || [];
    return groups.map((group) => ({
      date: group.dimensions?.datetime,
      requests: group.sum?.requests || 0,
      bytes: group.sum?.bytes || 0,
      pageViews: group.sum?.pageViews || 0,
      visits: group.uniq?.uniques || 0,
      isHourly: true,
    }));
  } catch (error) {
    console.error(
      "Hourly time series query error:",
      error.response?.data || error.message
    );
    return [];
  }
}

// 获取区域请求数据（用于柱状图）
export async function getCountryAnalytics(days: number = 7): Promise<CountryData[]> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d: Date): string => (d.toISOString().split("T")[0] || "");

  const query = `
    query GetCountryAnalytics($accountTag: String!, $start: Date!, $end: Date!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          httpRequests1dGroups(
            limit: 1000
            filter: { date_geq: $start, date_lt: $end }
          ) {
            dimensions {
              date
            }
            sum {
              requests
              bytes
              countryMap {
                clientCountryName
                requests
                bytes
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        query,
        variables: {
          accountTag: CF_ACCOUNT_ID,
          start: formatDate(startDate),
          end: formatDate(now),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errors) {
      console.error("GraphQL errors:", response.data.errors);
      return [];
    }

    const accounts = response.data?.data?.viewer?.accounts;
    if (!accounts || accounts.length === 0) {
      return [];
    }

    const groups = accounts[0].httpRequests1dGroups || [];

    // 聚合所有日期的国家数据
    const countryMap = new Map<string, { requests: number; bytes: number }>();
    const countryTimeSeries = new Map<string, Array<{ date: string; requests: number; bytes: number }>>(); // 存储每个国家的时间序列

    groups.forEach((group) => {
      const date = group.dimensions?.date;
      const countries = group.sum?.countryMap || [];

      countries.forEach((country) => {
        const name = country.clientCountryName || "Unknown";

        // 聚合总数
        if (!countryMap.has(name)) {
          countryMap.set(name, { requests: 0, bytes: 0 });
        }
        const existing = countryMap.get(name);
        if (existing) {
          existing.requests += country.requests || 0;
          existing.bytes += country.bytes || 0;
        }

        // 存储时间序列
        if (!countryTimeSeries.has(name)) {
          countryTimeSeries.set(name, []);
        }
        countryTimeSeries.get(name)?.push({
          date,
          requests: country.requests || 0,
          bytes: country.bytes || 0,
        });
      });
    });

    // 转换为数组并排序
    const result = Array.from(countryMap.entries())
      .map(([country, data]) => ({
        country,
        requests: data.requests,
        bytes: data.bytes,
        timeSeries: countryTimeSeries.get(country) || [],
      }))
      .sort((a, b) => b.requests - a.requests);

    return result;
  } catch (error) {
    console.error(
      "Country analytics query error:",
      error.response?.data || error.message
    );
    return [];
  }
}

// 获取详细统计数据（安全性、缓存、错误）
export async function getDetailedStats(days: number = 7, zoneName?: string): Promise<DetailedStatsResult> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const prevStartDate = new Date(startDate);
  prevStartDate.setDate(prevStartDate.getDate() - days);

  const formatDate = (d: Date): string => (d.toISOString().split("T")[0] || "");

  try {
    // 获取zoneId（如果提供了zoneName）
    let zoneId: string | null | undefined;
    if (zoneName) {
      zoneId = await getZoneIdByName(zoneName);
    }

    const [current, prev] = await Promise.all([
      queryDetailedStats(formatDate(startDate), formatDate(now), zoneId || ''),
      queryDetailedStats(formatDate(prevStartDate), formatDate(startDate), zoneId || ''),
    ]);

    const calcChange = (curr: number, previous: number): number => {
      if (previous === 0) return curr > 0 ? 100 : 0;
      return ((curr - previous) / previous) * 100;
    };

    return {
      security: {
        encryptedRequests: {
          value: current.encryptedRequests,
          change: calcChange(current.encryptedRequests, prev.encryptedRequests),
        },
        encryptedRequestsRate: {
          value:
            current.requests > 0
              ? (current.encryptedRequests / current.requests) * 100
              : 0,
          change: calcChange(
            current.requests > 0
              ? current.encryptedRequests / current.requests
              : 0,
            prev.requests > 0 ? prev.encryptedRequests / prev.requests : 0
          ),
        },
        encryptedBytes: {
          value: current.encryptedBytes,
          change: calcChange(current.encryptedBytes, prev.encryptedBytes),
        },
        encryptedBytesRate: {
          value:
            current.bytes > 0
              ? (current.encryptedBytes / current.bytes) * 100
              : 0,
          change: calcChange(
            current.bytes > 0 ? current.encryptedBytes / current.bytes : 0,
            prev.bytes > 0 ? prev.encryptedBytes / prev.bytes : 0
          ),
        },
      },
      cache: {
        cachedRequests: {
          value: current.cachedRequests,
          change: calcChange(current.cachedRequests, prev.cachedRequests),
        },
        cachedRequestsRate: {
          value:
            current.requests > 0
              ? (current.cachedRequests / current.requests) * 100
              : 0,
          change: calcChange(
            current.requests > 0
              ? current.cachedRequests / current.requests
              : 0,
            prev.requests > 0 ? prev.cachedRequests / prev.requests : 0
          ),
        },
        cachedBytes: {
          value: current.cachedBytes,
          change: calcChange(current.cachedBytes, prev.cachedBytes),
        },
        cachedBytesRate: {
          value:
            current.bytes > 0 ? (current.cachedBytes / current.bytes) * 100 : 0,
          change: calcChange(
            current.bytes > 0 ? current.cachedBytes / current.bytes : 0,
            prev.bytes > 0 ? prev.cachedBytes / prev.bytes : 0
          ),
        },
      },
      errors: {
        status4xx: {
          value: current.status4xx,
          change: calcChange(current.status4xx, prev.status4xx),
        },
        status4xxRate: {
          value:
            current.requests > 0
              ? (current.status4xx / current.requests) * 100
              : 0,
          change: calcChange(
            current.requests > 0 ? current.status4xx / current.requests : 0,
            prev.requests > 0 ? prev.status4xx / prev.requests : 0
          ),
        },
        status5xx: {
          value: current.status5xx,
          change: calcChange(current.status5xx, prev.status5xx),
        },
        status5xxRate: {
          value:
            current.requests > 0
              ? (current.status5xx / current.requests) * 100
              : 0,
          change: calcChange(
            current.requests > 0 ? current.status5xx / current.requests : 0,
            prev.requests > 0 ? prev.status5xx / prev.requests : 0
          ),
        },
      },
    };
  } catch (error) {
    console.error("Error in getDetailedStats:", error.message);
    return { error: error.message, security: { encryptedRequests: { value: 0, change: 0 }, encryptedRequestsRate: { value: 0, change: 0 }, encryptedBytes: { value: 0, change: 0 }, encryptedBytesRate: { value: 0, change: 0 } }, cache: { cachedRequests: { value: 0, change: 0 }, cachedRequestsRate: { value: 0, change: 0 }, cachedBytes: { value: 0, change: 0 }, cachedBytesRate: { value: 0, change: 0 } }, errors: { status4xx: { value: 0, change: 0 }, status4xxRate: { value: 0, change: 0 }, status5xx: { value: 0, change: 0 }, status5xxRate: { value: 0, change: 0 } } };
  }
}

// 查询详细统计数据
async function queryDetailedStats(startDate: string, endDate: string, zoneTag?: string): Promise<DetailedStats> {
  let query: string;
  let variables;

  if (zoneTag) {
    // 查询特定域名的详细统计数据
    query = `
      query GetZoneDetailedStats($zoneTag: String!, $start: Date!, $end: Date!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequests1dGroups(
              limit: 100
              filter: { date_geq: $start, date_lt: $end }
            ) {
              sum {
                requests
                bytes
                cachedRequests
                cachedBytes
                encryptedRequests
                encryptedBytes
                responseStatusMap {
                  edgeResponseStatus
                  requests
                }
              }
            }
          }
        }
      }
    `;
    variables = {
      zoneTag,
      start: startDate,
      end: endDate,
    };
  } else {
    // 查询账户级别的详细统计数据
    query = `
      query GetAccountDetailedStats($accountTag: String!, $start: Date!, $end: Date!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            httpRequests1dGroups(
              limit: 100
              filter: { date_geq: $start, date_lt: $end }
            ) {
              sum {
                requests
                bytes
                cachedRequests
                cachedBytes
                encryptedRequests
                encryptedBytes
                responseStatusMap {
                  edgeResponseStatus
                  requests
                }
              }
            }
          }
        }
      }
    `;
    variables = {
      accountTag: CF_ACCOUNT_ID,
      start: startDate,
      end: endDate,
    };
  }

  try {
    const response = await axios.post(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        query,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errors) {
      console.error("GraphQL errors:", response.data.errors);
      return getEmptyDetailedStats();
    }

    let groups[] = [];
    if (zoneTag) {
      const zones = response.data?.data?.viewer?.zones;
      if (!zones || zones.length === 0) {
        return getEmptyDetailedStats();
      }
      groups = zones[0].httpRequests1dGroups || [];
    } else {
      const accounts = response.data?.data?.viewer?.accounts;
      if (!accounts || accounts.length === 0) {
        return getEmptyDetailedStats();
      }
      groups = accounts[0].httpRequests1dGroups || [];
    }

    let result = getEmptyDetailedStats();

    groups.forEach((group) => {
      result.requests += group.sum?.requests || 0;
      result.bytes += group.sum?.bytes || 0;
      result.cachedRequests += group.sum?.cachedRequests || 0;
      result.cachedBytes += group.sum?.cachedBytes || 0;
      result.encryptedRequests += group.sum?.encryptedRequests || 0;
      result.encryptedBytes += group.sum?.encryptedBytes || 0;

      const statusMap = group.sum?.responseStatusMap || [];
      statusMap.forEach((status) => {
        const code = status.edgeResponseStatus;
        if (code >= 400 && code < 500) {
          result.status4xx += status.requests || 0;
        } else if (code >= 500 && code < 600) {
          result.status5xx += status.requests || 0;
        }
      });
    });

    return result;
  } catch (error) {
    console.error(
      "Detailed stats query error:",
      error.response?.data || error.message
    );
    return getEmptyDetailedStats();
  }
}

function getEmptyDetailedStats(): DetailedStats {
  return {
    requests: 0,
    bytes: 0,
    cachedRequests: 0,
    cachedBytes: 0,
    encryptedRequests: 0,
    encryptedBytes: 0,
    status4xx: 0,
    status5xx: 0,
  };
}

// 获取网络统计数据（HTTP版本、SSL版本、内容类型）
export async function getNetworkStats(days: number = 7, zoneName?: string): Promise<NetworkStatsResult> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d: Date): string => (d.toISOString().split("T")[0] || "");

  let query: string;
  let variables;

  // 获取zoneId（如果提供了zoneName）
  let zoneId: string | undefined;
  if (zoneName) {
    zoneId = await getZoneIdByName(zoneName) || '';
  }

  if (zoneId) {
    // 查询特定域名的网络统计数据
    query = `
      query GetZoneNetworkStats($zoneTag: String!, $start: Date!, $end: Date!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequests1dGroups(
              limit: 100
              filter: { date_geq: $start, date_lt: $end }
            ) {
              sum {
                requests
                clientHTTPVersionMap {
                  clientHTTPProtocol
                  requests
                }
                clientSSLMap {
                  clientSSLProtocol
                  requests
                }
                contentTypeMap {
                  edgeResponseContentTypeName
                  requests
                }
              }
            }
          }
        }
      }
    `;
    variables = {
      zoneTag: zoneId,
      start: formatDate(startDate),
      end: formatDate(now),
    };
  } else {
    // 查询账户级别的网络统计数据
    query = `
      query GetAccountNetworkStats($accountTag: String!, $start: Date!, $end: Date!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            httpRequests1dGroups(
              limit: 100
              filter: { date_geq: $start, date_lt: $end }
            ) {
              sum {
                requests
                clientHTTPVersionMap {
                  clientHTTPProtocol
                  requests
                }
                clientSSLMap {
                  clientSSLProtocol
                  requests
                }
                contentTypeMap {
                  edgeResponseContentTypeName
                  requests
                }
              }
            }
          }
        }
      }
    `;
    variables = {
      accountTag: CF_ACCOUNT_ID,
      start: formatDate(startDate),
      end: formatDate(now),
    };
  }

  try {
    const response = await axios.post(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        query,
        variables,
      },
      {
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errors) {
      console.error("GraphQL errors:", response.data.errors);
      return { httpVersions: [], sslVersions: [], contentTypes: [] };
    }

    let groups[] = [];
    if (zoneId) {
      const zones = response.data?.data?.viewer?.zones;
      if (!zones || zones.length === 0) {
        return { httpVersions: [], sslVersions: [], contentTypes: [] };
      }
      groups = zones[0].httpRequests1dGroups || [];
    } else {
      const accounts = response.data?.data?.viewer?.accounts;
      if (!accounts || accounts.length === 0) {
        return { httpVersions: [], sslVersions: [], contentTypes: [] };
      }
      groups = accounts[0].httpRequests1dGroups || [];
    }

    // 聚合 HTTP 版本数据
    const httpVersionMap = new Map<string, number>();
    // 聚合 SSL 版本数据
    const sslVersionMap = new Map<string, number>();
    // 聚合内容类型数据
    const contentTypeMap = new Map<string, number>();

    groups.forEach((group) => {
      // HTTP 版本
      const httpVersions = group.sum?.clientHTTPVersionMap || [];
      httpVersions.forEach((item) => {
        const protocol = item.clientHTTPProtocol || "unknown";
        httpVersionMap.set(
          protocol,
          (httpVersionMap.get(protocol) || 0) + (item.requests || 0)
        );
      });

      // SSL 版本
      const sslVersions = group.sum?.clientSSLMap || [];
      sslVersions.forEach((item) => {
        const protocol = item.clientSSLProtocol || "unknown";
        sslVersionMap.set(
          protocol,
          (sslVersionMap.get(protocol) || 0) + (item.requests || 0)
        );
      });

      // 内容类型
      const contentTypes = group.sum?.contentTypeMap || [];
      contentTypes.forEach((item) => {
        const type = item.edgeResponseContentTypeName || "unknown";
        contentTypeMap.set(
          type,
          (contentTypeMap.get(type) || 0) + (item.requests || 0)
        );
      });
    });

    // 转换为数组并排序
    const httpVersions = Array.from(httpVersionMap.entries())
      .map(([name, requests]) => ({ name, requests }))
      .sort((a, b) => b.requests - a.requests);

    const sslVersions = Array.from(sslVersionMap.entries())
      .map(([name, requests]) => ({ name, requests }))
      .sort((a, b) => b.requests - a.requests);

    const contentTypes = Array.from(contentTypeMap.entries())
      .map(([name, requests]) => ({ name, requests }))
      .sort((a, b) => b.requests - a.requests);

    return { httpVersions, sslVersions, contentTypes };
  } catch (error) {
    console.error(
      "Network stats query error:",
      error.response?.data || error.message
    );
    return { httpVersions: [], sslVersions: [], contentTypes: [] };
  }
}

// 获取指定域名的 Zone ID
async function getZoneIdByName(zoneName: string): Promise<string | null> {
  const zones = await getZones();
  const zone = zones.find(
    (z) => z.name === zoneName || z.name.includes(zoneName)
  );
  return zone?.id || null;
}

// 获取单个域名的 Web 流量统计（请求、带宽、唯一访问者）
export async function getZoneWebTraffic(zoneName: string, days: number = 7): Promise<WebTrafficData> {
  const zoneId = await getZoneIdByName(zoneName);
  if (!zoneId) {
    return { error: `Zone not found: ${zoneName}`, requests: { total: 0, cached: 0, uncached: 0, max: 0, min: 0 }, bandwidth: { total: 0, cached: 0, uncached: 0, max: 0, min: 0 }, visitors: { total: 0, max: 0, min: 0 }, timeSeries: [], period: { start: '', end: '', days: 0 } };
  }

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d: Date): string => (d.toISOString().split("T")[0] || "");

  // 根据天数选择使用日级别或小时级别数据
  if (days <= 1) {
    return await getZoneWebTrafficHourly(zoneId, startDate, now);
  }

  const query = `
    query GetZoneWebTraffic($zoneTag: String!, $start: Date!, $end: Date!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 100
            filter: { date_geq: $start, date_lt: $end }
            orderBy: [date_ASC]
          ) {
            dimensions {
              date
            }
            sum {
              requests
              cachedRequests
              bytes
              cachedBytes
            }
            uniq {
              uniques
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        query,
        variables: {
          zoneTag: zoneId,
          start: formatDate(startDate),
          end: formatDate(now),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errors) {
      console.error("GraphQL errors:", response.data.errors);
      return getEmptyWebTraffic();
    }

    const zones = response.data?.data?.viewer?.zones;
    if (!zones || zones.length === 0) {
      return getEmptyWebTraffic();
    }

    const groups = zones[0].httpRequests1dGroups || [];

    // 聚合总数据
    let totalRequests = 0,
      cachedRequests = 0,
      totalBytes = 0,
      cachedBytes = 0,
      totalVisitors = 0;
    let maxRequests = 0,
      minRequests = Infinity,
      maxBytes = 0,
      minBytes = Infinity,
      maxVisitors = 0,
      minVisitors = Infinity;

    const timeSeries = groups.map((group) => {
      const requests = group.sum?.requests || 0;
      const cached = group.sum?.cachedRequests || 0;
      const bytes = group.sum?.bytes || 0;
      const cachedB = group.sum?.cachedBytes || 0;
      const visitors = group.uniq?.uniques || 0;

      totalRequests += requests;
      cachedRequests += cached;
      totalBytes += bytes;
      cachedBytes += cachedB;
      totalVisitors += visitors;

      maxRequests = Math.max(maxRequests, requests);
      minRequests = Math.min(minRequests, requests);
      maxBytes = Math.max(maxBytes, bytes);
      minBytes = Math.min(minBytes, bytes);
      maxVisitors = Math.max(maxVisitors, visitors);
      minVisitors = Math.min(minVisitors, visitors);

      return {
        date: group.dimensions?.date,
        requests,
        cachedRequests: cached,
        uncachedRequests: requests - cached,
        bytes,
        cachedBytes: cachedB,
        uncachedBytes: bytes - cachedB,
        visitors,
        isHourly: false,
      };
    });

    if (minRequests === Infinity) minRequests = 0;
    if (minBytes === Infinity) minBytes = 0;
    if (minVisitors === Infinity) minVisitors = 0;

    return {
      requests: {
        total: totalRequests,
        cached: cachedRequests,
        uncached: totalRequests - cachedRequests,
        max: maxRequests,
        min: minRequests,
      },
      bandwidth: {
        total: totalBytes,
        cached: cachedBytes,
        uncached: totalBytes - cachedBytes,
        max: maxBytes,
        min: minBytes,
      },
      visitors: {
        total: totalVisitors,
        max: maxVisitors,
        min: minVisitors,
      },
      timeSeries,
      period: { start: formatDate(startDate), end: formatDate(now), days },
    };
  } catch (error) {
    console.error(
      "Zone web traffic query error:",
      error.response?.data || error.message
    );
    return getEmptyWebTraffic();
  }
}

// 获取小时级别的域名流量数据
async function getZoneWebTrafficHourly(zoneId: string, startDate: Date, endDate: Date): Promise<WebTrafficData> {
  const query = `
    query GetZoneWebTrafficHourly($zoneTag: String!, $start: DateTime!, $end: DateTime!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1hGroups(
            limit: 100
            filter: { datetime_geq: $start, datetime_lt: $end }
            orderBy: [datetime_ASC]
          ) {
            dimensions {
              datetime
            }
            sum {
              requests
              cachedRequests
              bytes
              cachedBytes
            }
            uniq {
              uniques
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      "https://api.cloudflare.com/client/v4/graphql",
      {
        query,
        variables: {
          zoneTag: zoneId,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errors) {
      console.error("GraphQL errors:", response.data.errors);
      return getEmptyWebTraffic();
    }

    const zones = response.data?.data?.viewer?.zones;
    if (!zones || zones.length === 0) {
      return getEmptyWebTraffic();
    }

    const groups = zones[0].httpRequests1hGroups || [];

    let totalRequests = 0,
      cachedRequests = 0,
      totalBytes = 0,
      cachedBytes = 0,
      totalVisitors = 0;
    let maxRequests = 0,
      minRequests = Infinity,
      maxBytes = 0,
      minBytes = Infinity,
      maxVisitors = 0,
      minVisitors = Infinity;

    const timeSeries = groups.map((group) => {
      const requests = group.sum?.requests || 0;
      const cached = group.sum?.cachedRequests || 0;
      const bytes = group.sum?.bytes || 0;
      const cachedB = group.sum?.cachedBytes || 0;
      const visitors = group.uniq?.uniques || 0;

      totalRequests += requests;
      cachedRequests += cached;
      totalBytes += bytes;
      cachedBytes += cachedB;
      totalVisitors += visitors;

      maxRequests = Math.max(maxRequests, requests);
      minRequests = Math.min(minRequests, requests);
      maxBytes = Math.max(maxBytes, bytes);
      minBytes = Math.min(minBytes, bytes);
      maxVisitors = Math.max(maxVisitors, visitors);
      minVisitors = Math.min(minVisitors, visitors);

      return {
        date: group.dimensions?.datetime,
        requests,
        cachedRequests: cached,
        uncachedRequests: requests - cached,
        bytes,
        cachedBytes: cachedB,
        uncachedBytes: bytes - cachedB,
        visitors,
        isHourly: true,
      };
    });

    if (minRequests === Infinity) minRequests = 0;
    if (minBytes === Infinity) minBytes = 0;
    if (minVisitors === Infinity) minVisitors = 0;

    const formatDate = (d: Date): string => (d.toISOString().split("T")[0] || "");

    return {
      requests: {
        total: totalRequests,
        cached: cachedRequests,
        uncached: totalRequests - cachedRequests,
        max: maxRequests,
        min: minRequests,
      },
      bandwidth: {
        total: totalBytes,
        cached: cachedBytes,
        uncached: totalBytes - cachedBytes,
        max: maxBytes,
        min: minBytes,
      },
      visitors: {
        total: totalVisitors,
        max: maxVisitors,
        min: minVisitors,
      },
      timeSeries,
      period: {
        start: formatDate(startDate),
        end: formatDate(endDate),
        days: 1,
      },
    };
  } catch (error) {
    console.error(
      "Zone hourly traffic query error:",
      error.response?.data || error.message
    );
    return getEmptyWebTraffic();
  }
}

function getEmptyWebTraffic(): WebTrafficData {
  return {
    requests: { total: 0, cached: 0, uncached: 0, max: 0, min: 0 },
    bandwidth: { total: 0, cached: 0, uncached: 0, max: 0, min: 0 },
    visitors: { total: 0, max: 0, min: 0 },
    timeSeries: [],
    period: { start: "", end: "", days: 0 },
  };
}

// 获取所有 Workers
export 
}

// 获取所有 Workers 的分析数据
export 