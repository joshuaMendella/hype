// apps/web/scripts/check-onboarding-seed.ts
// Runnable self-check for the pure string logic in lib/onboarding/titles.ts.
import assert from "node:assert"
import { toSlug, stripLeadIn, workNodeTitle, isVagueWork } from "../lib/onboarding/titles"

assert.equal(toSlug("São Paulo!"), "s-o-paulo")
assert.equal(toSlug("Giessen"), "giessen")

assert.equal(stripLeadIn("I live in Giessen"), "Giessen")
assert.equal(stripLeadIn("i'm from Berlin"), "Berlin")
assert.equal(stripLeadIn("Giessen"), "Giessen")
assert.equal(stripLeadIn("it's Lisbon"), "Lisbon")

assert.equal(workNodeTitle("I'm a nurse at St. Mary's"), "I'm a nurse at St. Mary's".slice(0, 60))
assert.equal(workNodeTitle("studying biology"), "School")
assert.equal(workNodeTitle("a bit of both"), "Work")
assert.equal(workNodeTitle("work"), "Work")

assert.equal(isVagueWork("a bit of both"), true)
assert.equal(isVagueWork("work"), true)
assert.equal(isVagueWork("stuff"), true)
assert.equal(isVagueWork("mech eng at THM"), false)
assert.equal(isVagueWork("biology"), false)
assert.equal(isVagueWork("I'm a nurse"), false)

console.log("check-onboarding-seed: OK")
