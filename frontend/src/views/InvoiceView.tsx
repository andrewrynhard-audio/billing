import React, { useState, useEffect } from 'react';
import { StripeCustomerView, StripeProductView, StripeCoupon } from '../types';

interface InvoiceViewProps {
    customers: StripeCustomerView[];
    products: StripeProductView[];
    selectedCustomer: string;
    selectedProduct: StripeProductView | null;
    quantity: number;
    setSelectedCustomer: (id: string) => void;
    setSelectedProduct: (product: StripeProductView | null) => void;
    setQuantity: (quantity: number) => void;
    /**
     * Make sure handleCreateInvoice returns a Promise so we can await it.
     * E.g., handleCreateInvoice: (titles: string[]) => Promise<void>;
     */
    handleCreateInvoice: (titles: string[]) => Promise<void>;
    setShowInvoiceForm: (show: boolean) => void;
    availableCoupons: StripeCoupon[]; // List of coupons fetched from Stripe or cached
}

/**
 * Optional spinner component to show progress (example only).
 * Replace with your actual spinner, CSS, or other progress UI.
 */
function Spinner() {
    return (
        <div className="loading-indicator">
            <p>Sending invoice...</p>
            <div className="spinner"></div>
        </div>
    );
}

const InvoiceView: React.FC<InvoiceViewProps> = ({
    customers,
    products,
    selectedCustomer,
    selectedProduct,
    quantity,
    setSelectedCustomer,
    setSelectedProduct,
    setQuantity,
    handleCreateInvoice,
    setShowInvoiceForm,
    availableCoupons,
}) => {
    // Store the names of the titles for which the invoice is created
    const [titleNames, setTitleNames] = useState<string[]>([]);

    // Store the total discount in dollars, and the name of the coupon(s) applied
    const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
    const [couponName, setCouponName] = useState<string>('');

    /**
     * step controls which screen is shown:
     * - "form"   : the main invoice form
     * - "review" : the review screen
     * - "result" : success/failure page after sending
     */
    const [step, setStep] = useState<'form' | 'review' | 'result'>('form');

    /**
     * invoiceStatus indicates whether sending the invoice succeeded or failed:
     * - "success"
     * - "error"
     * - "" (empty when not sent yet or in progress)
     */
    const [invoiceStatus, setInvoiceStatus] = useState<'success' | 'error' | ''>('');

    /**
     * sendingInvoice is a local state to show a spinner or
     * some loading UI while the invoice is being created.
     */
    const [sendingInvoice, setSendingInvoice] = useState<boolean>(false);

    /**
     * Ensure the titleNames array matches the "quantity."
     * For each increment in quantity, add an empty string; for each decrement, remove from the end.
     */
    useEffect(() => {
        setTitleNames((prev) => {
            const newArr = [...prev];
            if (quantity > newArr.length) {
                while (newArr.length < quantity) {
                    newArr.push('');
                }
            } else if (quantity < newArr.length) {
                newArr.splice(quantity);
            }
            return newArr;
        });
    }, [quantity]);

    /**
     * Handler to update the name of a single title at a given index
     */
    const handleTitleNameChange = (index: number, value: string) => {
        setTitleNames((prev) => {
            const updated = [...prev];
            updated[index] = value;
            return updated;
        });
    };

    /**
     * Calculate the base total cost (without discounts).
     */
    const baseTotalCost = selectedProduct ? (selectedProduct.priceCents / 100) * quantity : 0;

    /**
     * Use a side effect to compute all discounts every time relevant values change.
     * This logic includes:
     * - bulk discount (bulk_tier_1, bulk_tier_2, bulk_tier_3)
     * - independent artist discount (independent_artist)
     * - applying them sequentially
     */
    useEffect(() => {
        if (!selectedProduct) {
            setAppliedDiscount(0);
            setCouponName('');
            return;
        }

        // Create a Map from coupon IDs to coupon objects for quick lookups
        const couponMap = new Map<string, StripeCoupon>(
            availableCoupons.map((coupon) => [coupon.id, coupon])
        );

        // Collect whichever coupons apply:
        const applicableCoupons: StripeCoupon[] = [];

        // 1) Bulk discount logic
        if (quantity >= 5 && quantity <= 10) {
            const bulkCoupon = couponMap.get('bulk_tier_1');
            if (bulkCoupon) applicableCoupons.push(bulkCoupon);
        } else if (quantity > 10 && quantity <= 15) {
            const bulkCoupon = couponMap.get('bulk_tier_2');
            if (bulkCoupon) applicableCoupons.push(bulkCoupon);
        } else if (quantity > 15) {
            const bulkCoupon = couponMap.get('bulk_tier_3');
            if (bulkCoupon) applicableCoupons.push(bulkCoupon);
        }

        // 2) Independent artist discount logic
        const customer = customers.find((c) => c.id === selectedCustomer);
        if (customer?.independent) {
            const independentCoupon = couponMap.get('independent_artist');
            if (independentCoupon) applicableCoupons.push(independentCoupon);
        }

        let discountedTotal = baseTotalCost;
        let fixedDiscount = 0; // For coupons that have an amountOff

        // Apply each coupon in the order collected or sorted (if desired).
        applicableCoupons.forEach((coupon) => {
            if (coupon.percentOff) {
                discountedTotal *= (100 - coupon.percentOff) / 100;
            } else if (coupon.amountOff) {
                // Convert cents to USD
                fixedDiscount += coupon.amountOff / 100;
            }
        });

        const finalDiscountedTotal = discountedTotal - fixedDiscount;
        const totalDiscount = baseTotalCost - finalDiscountedTotal;
        setAppliedDiscount(totalDiscount);

        // Create a comma-separated string of coupon names (or IDs if no name)
        const appliedNames = applicableCoupons
            .map((coupon) => coupon.name || coupon.id)
            .join(', ');
        setCouponName(appliedNames);
    }, [quantity, selectedProduct, selectedCustomer, customers, availableCoupons, baseTotalCost]);

    /**
     * finalTotalCost is the base cost minus the total discount.
     */
    const finalTotalCost = baseTotalCost - appliedDiscount;

    /**
     * Step 1 -> Step 2:
     * Instead of sending the invoice directly, we move to a "review" step to confirm details.
     */
    const handleReviewInvoice = () => {
        // Validate: user must fill each "title name" if required
        if (titleNames.some((w) => !w.trim())) {
            alert('Please fill in all required title name fields.');
            return;
        }
        // Clear the status & spinner if we previously attempted to send
        setInvoiceStatus('');
        setSendingInvoice(false);

        // Move to the review screen
        setStep('review');
    };

    /**
     * Step 2 -> Step 3:
     * Actually send (create) the invoice. Show spinner while in progress,
     * then show success or error in Step 3 once done.
     */
    const handleSendInvoice = async () => {
        setSendingInvoice(true);   // start spinner
        setInvoiceStatus('');      // clear old result if any

        try {
            await handleCreateInvoice(titleNames);
            // If successful, mark the invoiceStatus as success
            setInvoiceStatus('success');
        } catch (err) {
            console.error('Failed to create invoice:', err);
            // Mark the invoiceStatus as error
            setInvoiceStatus('error');
        }

        setSendingInvoice(false);  // stop spinner
        setStep('result');         // transition to the "result" view
    };

    return (
        <div className="invoice-form">
            {/* ------------------- STEP 1: FORM ------------------- */}
            {step === 'form' && (
                <>
                    <h3>Create Invoice</h3>

                    <label>Customer:</label>
                    <select
                        value={selectedCustomer}
                        onChange={(e) => setSelectedCustomer(e.target.value)}
                    >
                        <option value="" disabled>
                            Select a customer...
                        </option>
                        {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} - {c.email}
                            </option>
                        ))}
                    </select>

                    <label>Product:</label>
                    <select
                        value={selectedProduct?.id || ''}
                        onChange={(e) => {
                            const product = products.find((p) => p.id === e.target.value) || null;
                            setSelectedProduct(product);
                        }}
                    >
                        <option value="" disabled>
                            Select a product...
                        </option>
                        {products.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name} - ${p.priceCents / 100} per unit
                            </option>
                        ))}
                    </select>

                    <label>Quantity:</label>
                    <input
                        type="number"
                        value={quantity}
                        min={1}
                        onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                    />

                    <div style={{ margin: '1em 0' }}>
                        <h4>Enter the names of each title (quantity: {quantity})</h4>
                        <div className="titles-scrollable">
                            {titleNames.map((name, idx) => (
                                <div key={idx} style={{ marginBottom: '0.5em' }}>
                                    <label style={{ marginRight: '0.5em' }}>
                                        Title {idx + 1}:
                                    </label>
                                    <input
                                        style={{ width: '100%', boxSizing: 'border-box' }}
                                        type="text"
                                        value={name}
                                        onChange={(e) => handleTitleNameChange(idx, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <h4 style={{ marginTop: '1em' }}>
                        Base Total: ${baseTotalCost.toFixed(2)}
                    </h4>
                    {appliedDiscount > 0 && (
                        <h4 style={{ marginTop: '0.5em', color: 'green' }}>
                            Applied Discount ({couponName}): -${appliedDiscount.toFixed(2)}
                        </h4>
                    )}
                    <h4 style={{ marginTop: '0.5em', fontWeight: 'bold' }}>
                        Final Total: ${finalTotalCost.toFixed(2)}
                    </h4>

                    {/* Instead of "Send Invoice," we go to the review step */}
                    <button onClick={handleReviewInvoice}>Review Invoice</button>
                    <button onClick={() => setShowInvoiceForm(false)}>Cancel</button>
                </>
            )}

            {/* ------------------- STEP 2: REVIEW ------------------- */}
            {step === 'review' && (
                sendingInvoice ? (
                    /* Show only the spinner & sending message */
                    <div style={{ margin: '1em 0' }}>
                        <Spinner />
                    </div>
                ) : (
                    /* Otherwise show the entire review UI */
                    <>
                        <h3>Review Your Invoice</h3>

                        <p>
                            <strong>Customer:</strong>{' '}
                            {customers.find((c) => c.id === selectedCustomer)?.name || 'No customer selected'}
                        </p>
                        <p>
                            <strong>Product:</strong>{' '}
                            {selectedProduct
                                ? `${selectedProduct.name} x ${quantity}`
                                : 'No product selected'}
                        </p>

                        <p>
                            <strong>Titles:</strong>
                        </p>
                        <ul>
                            {titleNames.map((title, idx) => (
                                <li key={idx}>
                                    {idx + 1}. {title}
                                </li>
                            ))}
                        </ul>

                        <p>
                            <strong>Base Total:</strong> ${baseTotalCost.toFixed(2)}
                        </p>
                        {appliedDiscount > 0 && (
                            <p>
                                <strong>Discounts Applied ({couponName}):</strong> -$
                                {appliedDiscount.toFixed(2)}
                            </p>
                        )}
                        <p>
                            <strong>Final Total:</strong> ${finalTotalCost.toFixed(2)}
                        </p>

                        <button onClick={() => setStep('form')}>Back</button>
                        <button onClick={handleSendInvoice}>Send Invoice</button>
                    </>
                )
            )}

            {/* ------------------- STEP 3: RESULT ------------------- */}
            {step === 'result' && (
                <>
                    {/* Show success or error if we have a final status */}
                    {invoiceStatus === 'success' && !sendingInvoice && (
                        <>
                            <h3>Invoice Successfully Sent!</h3>
                            <p>Thank you! The invoice has been created.</p>
                        </>
                    )}
                    {invoiceStatus === 'error' && !sendingInvoice && (
                        <>
                            <h3>Error Sending Invoice</h3>
                            <p>Sorry, something went wrong while creating the invoice.</p>
                        </>
                    )}
                    {invoiceStatus === '' && !sendingInvoice && (
                        // If invoiceStatus is empty but not sending, we might show a message or do nothing
                        <p>Preparing to send invoice...</p>
                    )}

                    <button onClick={() => setShowInvoiceForm(false)}>Close</button>
                </>
            )}
        </div>
    );
};

export default InvoiceView;
