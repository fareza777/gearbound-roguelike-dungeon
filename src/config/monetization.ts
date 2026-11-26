/**
 * Centralized Google Play / AdMob Monetization Configuration for Gearbound.
 * Uses Google Official AdMob Test IDs by default — swap to production IDs
 * only inside this file prior to Google Play Store submission.
 *
 * Policy Compliance:
 * - Banner ad sits exclusively inside a dedicated bottom safe-area dock
 *   that never overlaps interactive controls or native Android navigation bars.
 * - Interstitial ads NEVER interrupt active duels; shown only at natural
 *   run/act transitions with a strict cooldown.
 * - Rewarded ads are 100% opt-in (Camp Bonus, Forge Recalibrate, 2x Offline Patrol).
 * - Purchasing "Remove Ads" (USD 4.99) permanently suppresses Banner & Interstitial ads.
 */

export const MONETIZATION_CONFIG = {
  isTesting: true,

  // Official Google AdMob Android Test Unit IDs
  admob: {
    androidAppId: 'ca-app-pub-3940256099942544~3347511713',
    bannerId: 'ca-app-pub-3940256099942544/6300978111',
    interstitialId: 'ca-app-pub-3940256099942544/1033173712',
    rewardedId: 'ca-app-pub-3940256099942544/5224354917',
    interstitialMinIntervalMs: 120_000 // at least 2 minutes between interstitials
  },

  iap: {
    removeAdsProductId: 'com.f7developer.gearbound.remove_ads',
    displayPriceUsd: '$4.99',
    title: 'Remove Ads',
    description:
      'Permanently removes all Banner and Interstitial advertisements across every expedition while keeping optional Rewarded bonuses available.'
  },

  store: {
    packageId: 'com.f7developer.gearbound',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.f7developer.gearbound',
    shareText:
      'Spin the Clockwork Combat Console, forge symbol synergies, and conquer 6 dungeon biomes offline in Gearbound!'
  }
} as const;
