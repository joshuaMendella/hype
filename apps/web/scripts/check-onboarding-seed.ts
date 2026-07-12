// apps/web/scripts/check-onboarding-seed.ts
// Runnable self-check for the pure string logic in lib/onboarding/seed.ts.
// DB functions require Supabase and are verified by manual drive, not here.
import assert from "node:assert"
import { toSlug, stripLeadIn, workNodeTitle } from "../lib/onboarding/seed"

assert.equal(toSlug("São Paulo!"), "s-o-paulo")
assert.equal(toSlug("Giessen"), "giessen")

assert.equal(stripLeadIn("I live in Giessen"), "Giessen")
assert.equal(stripLeadIn("i'm from Berlin"), "Berlin")
assert.equal(stripLeadIn("Giessen"), "Giessen")
assert.equal(stripLeadIn("it's Lisbon"), "Lisbon")

assert.equal(workNodeTitle("I'm a nurse at St. Mary's"), "I'm a nurse at St. Mary's".slice(0, 60))
assert.equal(workNodeTitle("studying biology"), "School")
assert.equal(workNodeTitle("I study at uni"), "School")
assert.equal(workNodeTitle("a bit of both"), "Work")
assert.equal(workNodeTitle("work"), "Work")

console.log("check-onboarding-seed: OK")
