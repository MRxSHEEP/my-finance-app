// Placeholder pending a real pricing decision — this pass ships the
// per-seat billing mechanism only, not a chosen price (see the Team/Seat
// Infrastructure plan's scope note). Mirrors lib/simulatedTrading/tiers.ts's
// own priceCents pattern.
export const SEAT_PRICE_CENTS = Number(process.env.STRIPE_SEAT_PRICE_CENTS) || 500;
