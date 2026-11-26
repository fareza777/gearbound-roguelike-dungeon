import { Capacitor, registerPlugin } from '@capacitor/core';
import { AdMob, BannerAdPosition, BannerAdSize, RewardAdPluginEvents } from '@capacitor-community/admob';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { StatusBar, Style } from '@capacitor/status-bar';
import { MONETIZATION_CONFIG } from '../config/monetization';

interface GearboundBillingPlugin {
  initialize(): Promise<{ ready: boolean }>;
  purchaseRemoveAds(): Promise<{ purchased: boolean; message?: string }>;
  restorePurchases(): Promise<{ removeAdsOwned: boolean }>;
}

const GearboundBilling = registerPlugin<GearboundBillingPlugin>('GearboundBilling');

class NativeBridge {
  private isNative = Capacitor.isNativePlatform();
  private admobReady = false;
  private bannerVisible = false;
  private lastInterstitialAt = 0;
  private hapticsEnabled = true;

  setHapticsEnabled(enabled: boolean): void {
    this.hapticsEnabled = enabled;
  }

  async init(theme: 'light' | 'dark', removeAdsOwned: boolean): Promise<void> {
    if (this.isNative) {
      document.documentElement.classList.add('native-android');
      try {
        await StatusBar.setOverlaysWebView({ overlay: false });
        // Dark cinematic status bar while Dual Splash Screens play
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0E0A08' });
      } catch {
        // Ignore on unsupported devices
      }
      try {
        await GearboundBilling.initialize();
      } catch {
        // Fallback handled gracefully
      }
      try {
        await AdMob.initialize({
          initializeForTesting: MONETIZATION_CONFIG.isTesting
        });
        this.admobReady = true;
      } catch {
        this.admobReady = false;
      }
    }
    if (removeAdsOwned) {
      await this.hideBanner();
    }
  }

  async applyStatusBarTheme(theme: 'light' | 'dark'): Promise<void> {
    if (!this.isNative) return;
    try {
      await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light });
      await StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#14110E' : '#E9DEC4' });
    } catch {
      // Ignore
    }
  }

  async haptic(kind: 'light' | 'medium' | 'heavy'): Promise<void> {
    if (!this.hapticsEnabled) return;
    if (this.isNative) {
      try {
        const map = {
          light: ImpactStyle.Light,
          medium: ImpactStyle.Medium,
          heavy: ImpactStyle.Heavy
        };
        await Haptics.impact({ style: map[kind] });
      } catch {
        // Ignore
      }
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const ms = kind === 'heavy' ? 28 : kind === 'medium' ? 14 : 7;
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignore
      }
    }
  }

  async showBanner(removeAdsOwned: boolean): Promise<void> {
    const dock = document.getElementById('ad-banner-dock');
    if (removeAdsOwned) {
      dock?.classList.add('hidden');
      await this.hideBanner();
      return;
    }
    dock?.classList.remove('hidden');
    if (!this.isNative || !this.admobReady || this.bannerVisible) return;
    try {
      await AdMob.showBanner({
        adId: MONETIZATION_CONFIG.admob.bannerId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin: 0,
        isTesting: MONETIZATION_CONFIG.isTesting
      });
      this.bannerVisible = true;
    } catch {
      this.bannerVisible = false;
    }
  }

  async hideBanner(): Promise<void> {
    const dock = document.getElementById('ad-banner-dock');
    dock?.classList.add('hidden');
    if (!this.isNative || !this.bannerVisible) return;
    try {
      await AdMob.hideBanner();
      this.bannerVisible = false;
    } catch {
      // Ignore
    }
  }

  async maybeShowInterstitial(removeAdsOwned: boolean): Promise<void> {
    if (removeAdsOwned) return;
    const now = Date.now();
    if (now - this.lastInterstitialAt < MONETIZATION_CONFIG.admob.interstitialMinIntervalMs) {
      return;
    }
    this.lastInterstitialAt = now;
    if (!this.isNative || !this.admobReady) return;
    try {
      await AdMob.prepareInterstitial({
        adId: MONETIZATION_CONFIG.admob.interstitialId,
        isTesting: MONETIZATION_CONFIG.isTesting
      });
      await AdMob.showInterstitial();
    } catch {
      // Never block gameplay on ad failure
    }
  }

  async showRewardedAd(onRewarded: () => void, onDismissed?: () => void): Promise<boolean> {
    if (!this.isNative || !this.admobReady) {
      // Web preview / test simulation with transparent notice
      onRewarded();
      return true;
    }
    try {
      let granted = false;
      const listener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        granted = true;
        onRewarded();
      });
      await AdMob.prepareRewardVideoAd({
        adId: MONETIZATION_CONFIG.admob.rewardedId,
        isTesting: MONETIZATION_CONFIG.isTesting
      });
      await AdMob.showRewardVideoAd();
      await listener.remove();
      if (!granted && onDismissed) onDismissed();
      return granted;
    } catch {
      if (onDismissed) onDismissed();
      return false;
    }
  }

  async purchaseRemoveAds(): Promise<{ purchased: boolean; message: string }> {
    if (this.isNative) {
      try {
        const res = await GearboundBilling.purchaseRemoveAds();
        if (res.purchased) {
          await this.hideBanner();
          return { purchased: true, message: 'Remove Ads activated permanently.' };
        }
        return { purchased: false, message: res.message || 'Purchase was not completed.' };
      } catch {
        return { purchased: false, message: 'Google Play Billing is unavailable on this device.' };
      }
    }
    // Web preview simulation for QA testing
    await this.hideBanner();
    return { purchased: true, message: 'Remove Ads unlocked (Test Preview Mode).' };
  }

  async restorePurchases(): Promise<boolean> {
    if (this.isNative) {
      try {
        const res = await GearboundBilling.restorePurchases();
        if (res.removeAdsOwned) await this.hideBanner();
        return res.removeAdsOwned;
      } catch {
        return false;
      }
    }
    return false;
  }

  async shareApp(): Promise<void> {
    if (this.isNative) {
      try {
        await Share.share({
          title: 'Gearbound: Roguelike Dungeon',
          text: MONETIZATION_CONFIG.store.shareText,
          url: MONETIZATION_CONFIG.store.playStoreUrl,
          dialogTitle: 'Share Gearbound'
        });
        return;
      } catch {
        // Fallback below
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Gearbound: Roguelike Dungeon',
          text: MONETIZATION_CONFIG.store.shareText,
          url: MONETIZATION_CONFIG.store.playStoreUrl
        });
        return;
      } catch {
        // Ignore cancel
      }
    }
    try {
      await navigator.clipboard.writeText(
        `${MONETIZATION_CONFIG.store.shareText} ${MONETIZATION_CONFIG.store.playStoreUrl}`
      );
    } catch {
      // Ignore
    }
  }

  openRatePage(): void {
    window.open(MONETIZATION_CONFIG.store.playStoreUrl, '_blank', 'noopener');
  }

  async saveBackup(key: string, json: string): Promise<void> {
    try {
      await Preferences.set({ key, value: json });
    } catch {
      // localStorage already persisted
    }
  }

  async loadBackup(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key });
      return value;
    } catch {
      return null;
    }
  }
}

export const nativeBridge = new NativeBridge();
