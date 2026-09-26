/**
 * Shared Razorpay checkout typings (https://checkout.razorpay.com/v1/checkout.js).
 *
 * Declared once here so the billing page and the workspace subscription card
 * share a single `window.Razorpay` global instead of declaring conflicting
 * ones. Razorpay only opens after a real successful backend response — never
 * on an error — and the billing backend is not connected on this deployment.
 */

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailureResponse {
  error: {
    description?: string;
    code?: string;
    reason?: string;
  };
}

export interface RazorpayCheckoutInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayFailureResponse) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckoutInstance;
  }
}

export {};
