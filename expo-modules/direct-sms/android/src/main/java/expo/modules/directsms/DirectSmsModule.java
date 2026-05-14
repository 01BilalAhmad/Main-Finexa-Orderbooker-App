package expo.modules.directsms;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.util.Collections;
import java.util.List;

import expo.modules.kotlin.Promise;
import expo.modules.kotlin.exception.CodedException;
import expo.modules.kotlin.modules.Module;
import expo.modules.kotlin.modules.ModuleDefinition;

public class DirectSmsModule extends Module {
    private static final String TAG = "DirectSms";
    private static final String SMS_SENT = "SMS_SENT";
    private static final String SMS_DELIVERED = "SMS_DELIVERED";

    @Override
    public String definition() {
        return "DirectSms";
    }

    @Override
    public void definition(ModuleDefinition builder) {
        builder.asyncFunction("sendDirectSms", this::sendDirectSms);
        builder.asyncFunction("checkPermission", this::checkPermission);
        builder.asyncFunction("requestPermission", this::requestPermission);
        builder.asyncFunction("isAvailable", this::isAvailable);
    }

    private void sendDirectSms(String phoneNumber, String message, Promise promise) {
        try {
            Context context = getContext();
            if (context == null) {
                promise.reject("ERR_NO_CONTEXT", "Application context is not available");
                return;
            }

            // Check permission
            if (!checkPermissionSync()) {
                promise.reject(
                    "ERR_NO_PERMISSION",
                    "SEND_SMS permission not granted. Please grant the permission in app settings."
                );
                return;
            }

            if (phoneNumber == null || phoneNumber.trim().isEmpty()) {
                promise.reject("ERR_INVALID_NUMBER", "Phone number is required");
                return;
            }

            if (message == null || message.trim().isEmpty()) {
                promise.reject("ERR_INVALID_MESSAGE", "Message is required");
                return;
            }

            // Clean phone number
            String cleanNumber = phoneNumber.replaceAll("[\\s\\-()]", "");

            // Get SmsManager
            android.telephony.SmsManager smsManager;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                smsManager = (android.telephony.SmsManager) context.getSystemService(Context.SMS_SERVICE);
            } else {
                smsManager = android.telephony.SmsManager.getDefault();
            }

            // Split message if > 160 chars
            java.util.ArrayList<String> parts = smsManager.divideMessage(message);
            java.util.ArrayList<android.app.PendingIntent> sentPIs = new java.util.ArrayList<>();
            java.util.ArrayList<android.app.PendingIntent> delPIs = new java.util.ArrayList<>();

            for (int i = 0; i < parts.size(); i++) {
                android.content.Intent si = new android.content.Intent(SMS_SENT);
                si.putExtra("idx", i);
                si.putExtra("total", parts.size());
                sentPIs.add(android.app.PendingIntent.getBroadcast(
                    context, (int) System.currentTimeMillis() + i, si,
                    android.app.PendingIntent.FLAG_IMMUTABLE
                ));

                android.content.Intent di = new android.content.Intent(SMS_DELIVERED);
                di.putExtra("idx", i);
                delPIs.add(android.app.PendingIntent.getBroadcast(
                    context, (int) System.currentTimeMillis() + 1000 + i, di,
                    android.app.PendingIntent.FLAG_IMMUTABLE
                ));
            }

            // Broadcast receiver for result
            android.content.BroadcastReceiver receiver = new android.content.BroadcastReceiver() {
                @Override
                public void onReceive(Context ctx, android.content.Intent intent) {
                    int idx = intent.getIntExtra("idx", -1);
                    int total = intent.getIntExtra("total", 1);
                    int code = getResultCode();

                    if (code == android.app.Activity.RESULT_OK) {
                        if (idx == total - 1) {
                            try { ctx.unregisterReceiver(this); } catch (Exception ignored) {}
                            promise.resolve(true);
                        }
                    } else {
                        try { ctx.unregisterReceiver(this); } catch (Exception ignored) {}
                        String errMsg;
                        switch (code) {
                            case android.telephony.SmsManager.RESULT_ERROR_NO_SERVICE:
                                errMsg = "No SMS service available";
                                break;
                            case android.telephony.SmsManager.RESULT_ERROR_RADIO_OFF:
                                errMsg = "Radio is off";
                                break;
                            default:
                                errMsg = "Failed to send SMS (part " + idx + ", code " + code + ")";
                                break;
                        }
                        promise.reject("ERR_SEND_FAILED", errMsg);
                    }
                }
            };

            context.registerReceiver(receiver, new android.content.IntentFilter(SMS_SENT));

            // Send
            if (parts.size() > 1) {
                smsManager.sendMultipartTextMessage(cleanNumber, null, parts, sentPIs, delPIs);
            } else {
                smsManager.sendTextMessage(cleanNumber, null, message, sentPIs.get(0), delPIs.get(0));
            }

        } catch (Exception e) {
            promise.reject("ERR_SMS_SEND", "Failed to send SMS: " + e.getMessage());
        }
    }

    private boolean checkPermissionSync() {
        Context ctx = getContext();
        if (ctx == null) return false;
        return ctx.checkSelfPermission("android.permission.SEND_SMS")
            == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    private void checkPermission(Promise promise) {
        promise.resolve(checkPermissionSync());
    }

    private void requestPermission(Promise promise) {
        requireContext().requirePermissions().requestPermission(
            "android.permission.SEND_SMS", promise
        );
    }

    private void isAvailable(Promise promise) {
        try {
            Context ctx = getContext();
            if (ctx == null) { promise.resolve(false); return; }

            android.telephony.TelephonyManager tm =
                (android.telephony.TelephonyManager) ctx.getSystemService(Context.TELEPHONY_SERVICE);

            boolean hasSim = tm != null
                && tm.getSimState() == android.telephony.TelephonyManager.SIM_STATE_READY;
            promise.resolve(hasSim && checkPermissionSync());
        } catch (Exception e) {
            promise.resolve(false);
        }
    }
}
