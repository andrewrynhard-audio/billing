export interface StripeCustomerView {
    id: string;
    name: string;
    email: string;
    independent: boolean;
}

export interface StripeProductView {
    id: string;
    name: string;
    priceID: string;
    priceCents: number;
}

export interface StripeCoupon {
    id: string; // Coupon ID
    name: string; // Display name of the coupon
    percentOff?: number; // Percentage off (optional)
    amountOff?: number; // Fixed discount amount in cents (optional)
    currency?: string; // Currency for the fixed discount amount (e.g., "usd")
    valid: boolean; // Indicates if the coupon is valid or expired
}
