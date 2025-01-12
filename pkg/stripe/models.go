package stripe

// StripeCustomerView is the data we send to the frontend for each customer.
type StripeCustomerView struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	Independent bool   `json:"independent"`
}

// StripeProductView is the data we send to the frontend for each product.
type StripeProductView struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	PriceID    string `json:"priceID"`    // Price ID for invoice creation
	PriceCents int64  `json:"priceCents"` // Unit price in cents from Stripe
}

// StripeCoupon is the data we send to the frontend for each coupon.
type StripeCoupon struct {
	ID         string  `json:"id"`         // Coupon ID
	Name       string  `json:"name"`       // Display name of the coupon
	PercentOff float64 `json:"percentOff"` // Percentage off (if applicable)
	AmountOff  int64   `json:"amountOff"`  // Fixed discount amount in cents (if applicable)
	Currency   string  `json:"currency"`   // Currency for amountOff
	Valid      bool    `json:"valid"`      // Indicates if the coupon is still valid
}
