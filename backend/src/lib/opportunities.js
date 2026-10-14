const normalise = value => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-NG");

function areaMatches(left, right) {
  const a = normalise(left), b = normalise(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

/**
 * Builds privacy-preserving demand signals from existing service requests.
 * Customer IDs are used only to enforce the minimum cohort size and are never returned.
 */
export function buildOpportunitySignals({ requests, listings, providerLocations = [], limit = 10 }) {
  const demand = new Map();
  for (const request of requests) {
    const category = request.service?.category?.name;
    const location = request.service?.location;
    if (!category || !location || !request.partnerId) continue;
    const key = normalise(category) + "|" + normalise(location);
    if (!demand.has(key)) demand.set(key, { category, area: location, customerIds: new Set(), requestCount: 0 });
    const group = demand.get(key);
    group.customerIds.add(request.partnerId);
    group.requestCount += 1;
  }

  const supply = new Map();
  for (const listing of listings) {
    const category = listing.category?.name;
    const location = listing.location;
    const providerId = listing.provider?.id ?? listing.providerId;
    if (!category || !location || !providerId) continue;
    const key = normalise(category) + "|" + normalise(location);
    if (!supply.has(key)) supply.set(key, { providerIds: new Set() });
    supply.get(key).providerIds.add(providerId);
  }

  return [...demand.entries()]
    .filter(([, group]) => group.customerIds.size >= 3)
    .map(([key, group]) => {
      const activeProviders = supply.get(key)?.providerIds.size ?? 0;
      const distinctCustomers = group.customerIds.size;
      const localMatch = providerLocations.some(location => areaMatches(location, group.area));
      const demandPerProvider = Math.round((distinctCustomers / Math.max(1, activeProviders)) * 10) / 10;
      return {
        category: group.category,
        area: group.area,
        recentCustomers: distinctCustomers,
        recentRequests: group.requestCount,
        activeProviders,
        demandPerProvider,
        localMatch,
        opportunityLevel: demandPerProvider >= 3 ? "high" : demandPerProvider >= 1.5 ? "medium" : "emerging"
      };
    })
    .sort((a, b) => Number(b.localMatch) - Number(a.localMatch) || b.demandPerProvider - a.demandPerProvider || b.recentCustomers - a.recentCustomers)
    .slice(0, Math.max(1, Math.min(20, Number(limit) || 10)));
}
