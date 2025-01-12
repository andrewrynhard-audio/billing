package stripe

import (
	"context"
	"fmt"
	"strconv"

	"log"
	"sync"
	"time"

	"github.com/stripe/stripe-go/v74"
	"github.com/stripe/stripe-go/v74/coupon"
	"github.com/stripe/stripe-go/v74/customer"
	"github.com/stripe/stripe-go/v74/invoice"
	"github.com/stripe/stripe-go/v74/invoiceitem"
	"github.com/stripe/stripe-go/v74/price"
	"github.com/stripe/stripe-go/v74/product"
)

var (
	cachedCustomers []*stripe.Customer
	cachedProducts  []*StripeProductView
	cachedCoupons   = make(map[string]*StripeCoupon)
	cacheLock       sync.RWMutex
)

const cacheRefreshInterval = 15 * time.Minute // Refresh cache every 15 minutes

// GetCachedCoupon retrieves a coupon from the cache by ID
func GetCachedCoupon(couponID string) (*StripeCoupon, error) {
	cacheLock.RLock()
	cachedCoupon, found := cachedCoupons[couponID]
	cacheLock.RUnlock()

	if found {
		return cachedCoupon, nil
	}

	return nil, fmt.Errorf("coupon not found in cache: %s", couponID)
}

// InitStripe initializes the Stripe cache at startup
func InitStripe(stripeSecretKey string) {
	stripe.Key = stripeSecretKey

	// Synchronous cache refresh at startup
	log.Println("Performing initial cache refresh...")
	err := forceRefreshCacheSync()
	if err != nil {
		log.Fatalf("Initial cache refresh failed: %v", err)
	}

	// Start background cache refresh
	go refreshCache()
}

// Force a synchronous cache refresh at startup
func forceRefreshCacheSync() error {
	customers, err := fetchCustomers()
	if err != nil {
		return fmt.Errorf("failed to fetch customers: %w", err)
	}

	products, err := fetchProductsWithPrices()
	if err != nil {
		return fmt.Errorf("failed to fetch products: %w", err)
	}

	err = fetchCoupons()
	if err != nil {
		return fmt.Errorf("failed to fetch coupons: %w", err)
	}

	cacheLock.Lock()
	defer cacheLock.Unlock()

	cachedCustomers = customers
	cachedProducts = products
	log.Println("Initial Stripe cache refresh completed.")
	return nil
}

func refreshCache() {
	for {
		log.Println("Refreshing Stripe cache...")
		err := forceRefreshCacheSync() // Reuse the synchronous refresh
		if err != nil {
			log.Printf("Error during cache refresh: %v\n", err)
		}
		time.Sleep(cacheRefreshInterval)
	}
}

func fetchCustomers() ([]*stripe.Customer, error) {
	var customers []*stripe.Customer
	params := &stripe.CustomerListParams{}
	i := customer.List(params)

	for i.Next() {
		customers = append(customers, i.Customer())
	}
	return customers, i.Err()
}

func fetchProductsWithPrices() ([]*StripeProductView, error) {
	var products []*StripeProductView
	params := &stripe.ProductListParams{
		Active: stripe.Bool(true),
	}
	i := product.List(params)

	for i.Next() {
		prod := i.Product()

		// Fetch the active price for this product
		priceParams := &stripe.PriceListParams{
			Product: stripe.String(prod.ID),
			Active:  stripe.Bool(true),
		}
		priceIter := price.List(priceParams)

		if !priceIter.Next() {
			continue
		}

		activePrice := priceIter.Price()

		products = append(products, &StripeProductView{
			ID:         prod.ID,
			Name:       prod.Name,
			PriceID:    activePrice.ID,
			PriceCents: activePrice.UnitAmount,
		})
	}
	return products, nil
}

func fetchCoupons() error {
	log.Println("Refreshing coupon cache...")
	params := &stripe.CouponListParams{}
	i := coupon.List(params)

	cache := make(map[string]*StripeCoupon)

	for i.Next() {
		c := i.Coupon()
		cache[c.ID] = &StripeCoupon{
			ID:         c.ID,
			Name:       c.Name,
			PercentOff: c.PercentOff,
			AmountOff:  c.AmountOff,
			Currency:   string(c.Currency),
			Valid:      c.Valid,
		}
	}

	if i.Err() != nil {
		return fmt.Errorf("Failed to refresh coupon cache: %v", i.Err())
	}

	cacheLock.Lock()
	cachedCoupons = cache
	cacheLock.Unlock()

	log.Println("Coupon cache refreshed.")

	return nil
}

// ForceRefreshCache triggers an immediate cache refresh.
func ForceRefreshCache() {
	go func() {
		log.Println("Forcing Stripe cache refresh...")
		customers, err := fetchCustomers()
		if err == nil {
			cacheLock.Lock()
			cachedCustomers = customers
			cacheLock.Unlock()
		}

		products, err := fetchProductsWithPrices()
		if err == nil {
			cacheLock.Lock()
			cachedProducts = products
			cacheLock.Unlock()
		}

		log.Println("Stripe cache forcibly refreshed.")
	}()
}

// GetCachedCustomers retrieves customers from the cache
func GetCachedCustomers() []*stripe.Customer {
	cacheLock.RLock()
	defer cacheLock.RUnlock()
	return cachedCustomers
}

// GetCachedProducts retrieves products from the cache
func GetCachedProducts() []*StripeProductView {
	cacheLock.RLock()
	defer cacheLock.RUnlock()
	return cachedProducts
}

func GetCachedCoupons() map[string]*StripeCoupon {
	cacheLock.RLock()
	defer cacheLock.RUnlock()
	return cachedCoupons
}

// CreateCustomer creates a new customer with a discount in metadata
func CreateCustomer(ctx context.Context, name, email string, independent bool) (*stripe.Customer, error) {
	params := &stripe.CustomerParams{
		Name:  stripe.String(name),
		Email: stripe.String(email),
	}

	// Store customer type in metadata
	params.AddMetadata("independent", strconv.FormatBool(independent))

	customer, err := customer.New(params)
	if err != nil {
		return nil, fmt.Errorf("creating customer failed: %w", err)
	}

	return customer, nil
}

// GetProducts retrieves the cached list of products and their prices.
func GetProducts() ([]*StripeProductView, error) {
	cacheLock.RLock()          // Read lock to safely access cached products
	defer cacheLock.RUnlock()  // Unlock after function finishes
	return cachedProducts, nil // Return cached products
}

// CreateInvoice creates a Stripe invoice for a given customer and sends it
func CreateInvoice(ctx context.Context, customerID, priceID string, quantity int64, description string) (*stripe.Invoice, error) {
	// 1) Fetch the customer
	cust, err := customer.Get(customerID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve customer: %w", err)
	}

	// 2) Fetch the price details
	priceDetails, err := price.Get(priceID, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve price: %w", err)
	}

	// 3) Apply discount logic (if any)
	var discounts []*stripe.InvoiceDiscountParams

	switch {
	case quantity >= 5 && quantity <= 10:
		couponID := "bulk_tier_1" // Pre-configured coupon ID
		discounts = append(discounts, &stripe.InvoiceDiscountParams{Coupon: stripe.String(couponID)})
	case quantity > 10 && quantity <= 15:
		couponID := "bulk_tier_2" // Pre-configured coupon ID
		discounts = append(discounts, &stripe.InvoiceDiscountParams{Coupon: stripe.String(couponID)})
	case quantity > 15:
		couponID := "bulk_tier_3" // Pre-configured coupon ID
		discounts = append(discounts, &stripe.InvoiceDiscountParams{Coupon: stripe.String(couponID)})
	}

	if cust.Metadata["independent"] == "true" {
		couponID := "independent_artist" // Pre-configured coupon ID
		discounts = append(discounts, &stripe.InvoiceDiscountParams{Coupon: stripe.String(couponID)})
	}

	// 4) Create the invoice first
	invParams := &stripe.InvoiceParams{
		Customer:         stripe.String(customerID),
		AutoAdvance:      stripe.Bool(true),
		CollectionMethod: stripe.String(string(stripe.InvoiceCollectionMethodSendInvoice)),
		DaysUntilDue:     stripe.Int64(30), // 30-day payment terms
		Description:      stripe.String(description),
		Discounts:        discounts,
	}

	newInvoice, err := invoice.New(invParams)
	if err != nil {
		return nil, fmt.Errorf("creating invoice failed: %w", err)
	}

	// 5) Create the invoice item and attach it to the newly-created invoice
	iiParams := &stripe.InvoiceItemParams{
		Customer: stripe.String(customerID),
		Invoice:  stripe.String(newInvoice.ID), // Attach to this specific invoice
		PriceData: &stripe.InvoiceItemPriceDataParams{
			Currency:   stripe.String("usd"),
			Product:    stripe.String(priceDetails.Product.ID),
			UnitAmount: stripe.Int64(priceDetails.UnitAmount),
		},
		Quantity: stripe.Int64(quantity),
	}

	_, err = invoiceitem.New(iiParams)
	if err != nil {
		return nil, fmt.Errorf("creating invoice item failed: %w", err)
	}

	// 6) Send (finalize) the invoice
	sentInvoice, err := invoice.SendInvoice(newInvoice.ID, nil)
	if err != nil {
		return nil, fmt.Errorf("sending invoice failed: %w", err)
	}

	return sentInvoice, nil
}
