import test from "node:test";
import assert from "node:assert/strict";
import { validateProviderRegistration } from "../src/lib/registration.js";

test("keeps legacy provider registrations as individuals by default", () => {
  assert.deepEqual(validateProviderRegistration({}), {
    error: null,
    providerType: "INDIVIDUAL",
    companyName: null
  });
});

test("accepts an individual provider without a company name", () => {
  assert.deepEqual(validateProviderRegistration({
    providerType: "INDIVIDUAL",
    companyName: ""
  }), {
    error: null,
    providerType: "INDIVIDUAL",
    companyName: null
  });
});

test("accepts and trims a company or business name", () => {
  assert.deepEqual(validateProviderRegistration({
    providerType: "COMPANY",
    companyName: "  Adeola Home Services  "
  }), {
    error: null,
    providerType: "COMPANY",
    companyName: "Adeola Home Services"
  });
});

test("requires a company name for company accounts", () => {
  assert.equal(validateProviderRegistration({
    providerType: "COMPANY",
    companyName: "  "
  }).error, "Enter your company or business name.");
});

test("rejects unsupported provider account types", () => {
  assert.equal(validateProviderRegistration({
    providerType: "ADMIN",
    companyName: "Example"
  }).error, "Choose a supported provider account type.");
});

test("rejects company names longer than the database-supported limit", () => {
  assert.equal(validateProviderRegistration({
    providerType: "COMPANY",
    companyName: "x".repeat(121)
  }).error, "Company or business name must be 120 characters or fewer.");
});
