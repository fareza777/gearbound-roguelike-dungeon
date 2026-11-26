package com.f7developer.gearbound;

import android.app.Activity;
import androidx.annotation.NonNull;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "GearboundBilling")
public class GearboundBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private static final String REMOVE_ADS_SKU = "com.f7developer.gearbound.remove_ads";
    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;

    private void ensureClient(Runnable onReady, Runnable onFailed) {
        if (billingClient != null && billingClient.isReady()) {
            onReady.run();
            return;
        }
        billingClient = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases()
                .build();
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(@NonNull BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    onReady.run();
                } else if (onFailed != null) {
                    onFailed.run();
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Reconnects lazily on next user action
            }
        });
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        ensureClient(
                () -> {
                    JSObject ret = new JSObject();
                    ret.put("ready", true);
                    call.resolve(ret);
                },
                () -> {
                    JSObject ret = new JSObject();
                    ret.put("ready", false);
                    call.resolve(ret);
                }
        );
    }

    @PluginMethod
    public void purchaseRemoveAds(PluginCall call) {
        ensureClient(() -> {
            QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(REMOVE_ADS_SKU)
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build();
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                    .setProductList(Collections.singletonList(product))
                    .build();

            billingClient.queryProductDetailsAsync(params, (billingResult, productDetailsList) -> {
                if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK
                        || productDetailsList == null || productDetailsList.isEmpty()) {
                    JSObject ret = new JSObject();
                    ret.put("purchased", false);
                    ret.put("message", "Remove Ads ($4.99) product will be available once published on Google Play.");
                    call.resolve(ret);
                    return;
                }
                ProductDetails details = productDetailsList.get(0);
                Activity activity = getActivity();
                if (activity == null) {
                    call.reject("Activity unavailable");
                    return;
                }
                pendingPurchaseCall = call;
                BillingFlowParams.ProductDetailsParams pdParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(details)
                        .build();
                BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(Collections.singletonList(pdParams))
                        .build();
                billingClient.launchBillingFlow(activity, flowParams);
            });
        }, () -> {
            JSObject ret = new JSObject();
            ret.put("purchased", false);
            ret.put("message", "Google Play Billing unavailable.");
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void restorePurchases(PluginCall call) {
        ensureClient(() -> {
            QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build();
            billingClient.queryPurchasesAsync(params, (result, purchases) -> {
                boolean owned = false;
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
                    for (Purchase p : purchases) {
                        if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED
                                && p.getProducts().contains(REMOVE_ADS_SKU)) {
                            owned = true;
                            acknowledgeIfNeeded(p);
                        }
                    }
                }
                JSObject ret = new JSObject();
                ret.put("removeAdsOwned", owned);
                call.resolve(ret);
            });
        }, () -> {
            JSObject ret = new JSObject();
            ret.put("removeAdsOwned", false);
            call.resolve(ret);
        });
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult billingResult, List<Purchase> purchases) {
        if (pendingPurchaseCall == null) return;
        PluginCall call = pendingPurchaseCall;
        pendingPurchaseCall = null;

        if (billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED
                        && p.getProducts().contains(REMOVE_ADS_SKU)) {
                    acknowledgeIfNeeded(p);
                    JSObject ret = new JSObject();
                    ret.put("purchased", true);
                    ret.put("message", "Remove Ads unlocked permanently!");
                    call.resolve(ret);
                    return;
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("purchased", false);
        ret.put("message", "Purchase canceled or not completed.");
        call.resolve(ret);
    }

    private void acknowledgeIfNeeded(Purchase purchase) {
        if (purchase.isAcknowledged() || billingClient == null) return;
        AcknowledgePurchaseParams ackParams = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.getPurchaseToken())
                .build();
        billingClient.acknowledgePurchase(ackParams, result -> {});
    }
}
