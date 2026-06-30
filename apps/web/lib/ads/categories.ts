// Static topic → affiliate-category map. Day-1 ad revenue is affiliate links
// (Amazon Associates, Ticketmaster, Booking.com) — that needs nothing more than a
// search category per topic. Topics absent from this map are non-commercial
// (Identity, Beliefs, Relationships, …) and yield no affiliate category.
// ponytail: a plain map, not a service — upgrade to per-merchant routing only when
// a second merchant per category actually exists.
export const AFFILIATE_CATEGORY: Record<string, string> = {
  Style:         "fashion",
  Beauty:        "beauty",
  Food:          "grocery",
  Home:          "home-kitchen",
  "Real Estate": "home-services",
  Technology:    "electronics",
  Gaming:        "video-games",
  Sports:        "sports-outdoors",
  Health:        "health-household",
  Hobbies:       "hobbies",
  Creativity:    "arts-crafts",
  Pets:          "pet-supplies",
  Vehicle:       "automotive",
  Travel:        "travel",        // Booking.com
  Entertainment: "events",        // Ticketmaster
  Events:        "events",
}

export function affiliateCategory(topic?: string | null): string | null {
  return topic ? AFFILIATE_CATEGORY[topic] ?? null : null
}
