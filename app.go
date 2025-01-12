package main

import (
	"context"
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"billing/pkg/stripe"
)

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) GetSettings() (*Settings, error) {
	return LoadSettings()
}

func (a *App) SetAPIKey(apiKey string) error {
	return SaveSettings(apiKey)
}

func (a *App) ForceRefreshCache() {
	stripe.ForceRefreshCache()
}

// GetCustomers is called from the frontend to fetch a list of Stripe customers
func (a *App) GetCustomers() []*stripe.StripeCustomerView {
	customers := stripe.GetCachedCustomers()

	var result []*stripe.StripeCustomerView
	for _, c := range customers {
		result = append(result, &stripe.StripeCustomerView{
			ID:          c.ID,
			Name:        c.Name,
			Email:       c.Email,
			Independent: c.Metadata["independent"] == "true",
		})
	}
	return result
}

// GetProducts is called from the frontend to fetch product types from Stripe
func (a *App) GetProducts() []*stripe.StripeProductView {
	products, err := stripe.GetProducts()
	if err != nil {
		runtime.LogErrorf(a.ctx, "Failed to get products: %v", err)
		return nil
	}

	var result []*stripe.StripeProductView
	for _, p := range products {
		result = append(result, &stripe.StripeProductView{
			ID:         p.ID,
			Name:       p.Name,
			PriceID:    p.PriceID,
			PriceCents: p.PriceCents,
		})
	}
	return result
}

// CreateCustomer is called from the frontend to create a customer in Stripe
func (a *App) CreateCustomer(name, email string, independent bool) (*stripe.StripeCustomerView, error) {
	customer, err := stripe.CreateCustomer(a.ctx, name, email, independent) // Full Stripe customer object
	if err != nil {
		runtime.LogErrorf(a.ctx, "Failed to create customer: %v", err)
		return nil, fmt.Errorf("failed to create customer: %w", err)
	}

	// Return a simplified view of the customer
	return &stripe.StripeCustomerView{
		ID:          customer.ID,
		Name:        customer.Name,
		Email:       customer.Email,
		Independent: customer.Metadata["independent"] == "true",
	}, nil
}

// CreateInvoice is called from the frontend to create & send an invoice
func (a *App) CreateInvoice(customerID, priceID string, quantity int64, description string) (string, error) {
	// Call the stripe.CreateInvoice function directly with the PriceID
	inv, err := stripe.CreateInvoice(a.ctx, customerID, priceID, quantity, description)
	if err != nil {
		return "", err
	}

	return inv.ID, nil
}

func (a *App) GetCoupons() (map[string]*stripe.StripeCoupon, error) {
	return stripe.GetCachedCoupons(), nil
}
