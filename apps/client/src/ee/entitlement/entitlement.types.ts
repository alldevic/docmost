export type Tier = "free" | "standard" | "business" | "enterprise";

export type Entitlements = {
  tier: Tier;
  features: string[];
};
