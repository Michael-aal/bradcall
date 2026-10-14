import test from "node:test";
import assert from "node:assert/strict";
import { buildOpportunitySignals } from "../src/lib/opportunities.js";

const requests = [
  { partnerId: "c1", service: { location: "Ikeja, Lagos", category: { name: "Cleaning" } } },
  { partnerId: "c1", service: { location: "Ikeja, Lagos", category: { name: "Cleaning" } } },
  { partnerId: "c2", service: { location: "Ikeja, Lagos", category: { name: "Cleaning" } } },
  { partnerId: "c3", service: { location: "Ikeja, Lagos", category: { name: "Cleaning" } } },
  { partnerId: "c4", service: { location: "Yaba, Lagos", category: { name: "Plumbing" } } },
  { partnerId: "c5", service: { location: "Yaba, Lagos", category: { name: "Plumbing" } } }
];

const listings = [
  { providerId: "p1", location: "Ikeja, Lagos", category: { name: "Cleaning" } },
  { providerId: "p1", location: "Ikeja, Lagos", category: { name: "Cleaning" } },
  { providerId: "p2", location: "Ikeja, Lagos", category: { name: "Cleaning" } }
];

test("requires at least three distinct customers before revealing a demand signal", () => {
  const result = buildOpportunitySignals({ requests, listings });
  assert.equal(result.length, 1);
  assert.equal(result[0].category, "Cleaning");
  assert.equal(result[0].recentCustomers, 3);
  assert.equal(result[0].recentRequests, 4);
});

test("counts distinct providers rather than listings and prioritises matching areas", () => {
  const result = buildOpportunitySignals({
    requests,
    listings,
    providerLocations: ["Ikeja, Lagos"]
  });
  assert.equal(result[0].activeProviders, 2);
  assert.equal(result[0].demandPerProvider, 1.5);
  assert.equal(result[0].localMatch, true);
});

test("does not expose customer or provider identifiers", () => {
  const result = buildOpportunitySignals({ requests, listings });
  assert.equal("customerIds" in result[0], false);
  assert.equal("providerIds" in result[0], false);
});

test("caps result count and tolerates empty data", () => {
  assert.deepEqual(buildOpportunitySignals({ requests: [], listings: [] }), []);
  assert.ok(buildOpportunitySignals({ requests, listings, limit: 100 }).length <= 20);
});
