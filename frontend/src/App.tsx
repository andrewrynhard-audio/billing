import React, { useEffect, useState } from 'react';
import './App.css';

import CustomersView from './views/CustomersView';  // For displaying customers
import InvoiceView from './views/InvoiceView';
import SettingsView from './views/Settings';

import { CreateCustomer } from '../wailsjs/go/main/App';

import { StripeCustomerView, StripeProductView, StripeCoupon } from './types'; // Import common types

import {
    GetCustomers,
    GetProducts,
    GetCoupons,
    CreateInvoice,
} from '../wailsjs/go/main/App';

type View = 'invoice' | 'customers' | 'settings';

function App() {
    const [customers, setCustomers] = useState<StripeCustomerView[]>([]);
    const [products, setProducts] = useState<StripeProductView[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<string>('');
    const [selectedProduct, setSelectedProduct] = useState<StripeProductView | null>(null);
    const [availableCoupons, setAvailableCoupons] = useState<StripeCoupon[]>([]); // Add state for coupons
    const [quantity, setQuantity] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);
    const [activeView, setActiveView] = useState<View>('invoice');

    const fetchData = async () => {
        setLoading(true);
        try {
            const fetchedCustomers = await GetCustomers();
            const fetchedProducts = await GetProducts();
            const fetchedCouponsObject = await GetCoupons();
            const fetchedCoupons = Object.values(fetchedCouponsObject);

            setCustomers(fetchedCustomers || []);
            setProducts(fetchedProducts || []);
            setAvailableCoupons(fetchedCoupons || []);
        } catch (err) {
            console.error('Failed to fetch data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreateInvoice = async (titles: string[]) => {
        if (!selectedCustomer || !selectedProduct || !selectedProduct.priceID) {
            alert('Please select a customer and a product with a valid price');
            return;
        }

        // Combine all the titles into one multi-line string
        const titlesDescription = titles
            .map((title, i) => `${i + 1}. ${title}`)
            .join('\n');

        try {
            // We now pass `titlesDescription` as the invoice description
            const invoiceID = await CreateInvoice(
                selectedCustomer,
                selectedProduct.priceID,
                quantity,
                titlesDescription
            );
            alert(`Invoice created successfully! Invoice ID: ${invoiceID}`);

            // Clear the form
            setSelectedCustomer('');
            setSelectedProduct(null);
            setQuantity(1);
        } catch (err) {
            console.error('Failed to create invoice:', err);
            alert('Failed to create invoice. Please try again.');
        }
    };

    const handleCreateCustomer = async (name: string, email: string, independent: boolean) => {
        try {
            const newCustomer: StripeCustomerView = await CreateCustomer(name, email, independent);  // Correct return type
            setCustomers([...customers, newCustomer]);  // Add the new customer to the list
            setActiveView('customers');  // Switch back to the customers view
            alert('Customer created successfully');
        } catch (err) {
            console.error('Failed to create customer:', err);
            alert('Failed to create customer');
        }
    };

    return (
        <div id="App">
            <nav className="sidebar">
                <button onClick={() => setActiveView('invoice')}>Create Invoice</button>
                <button onClick={() => setActiveView('customers')}>Customers</button>
                <button onClick={() => setActiveView('settings')}>Settings</button>
                <button onClick={fetchData} className="refresh-button" aria-label="Refresh">
                    <i className="fas fa-sync-alt"></i>
                </button>
            </nav>
            <main className="main-content">
                {loading ? (
                    <div className="loading-indicator">
                        <p>Loading data...</p>
                        <div className="spinner"></div>
                    </div>
                ) : activeView === 'invoice' ? (
                    <InvoiceView
                        customers={customers}
                        products={products}
                        selectedCustomer={selectedCustomer}
                        selectedProduct={selectedProduct}
                        quantity={quantity}
                        setSelectedCustomer={setSelectedCustomer}
                        setSelectedProduct={setSelectedProduct}
                        setQuantity={setQuantity}
                        handleCreateInvoice={handleCreateInvoice}
                        setShowInvoiceForm={() => { setActiveView('customers'); }}
                        availableCoupons={availableCoupons}
                    />
                ) : activeView === 'customers' ? (
                    <div>
                        <CustomersView customers={customers} onCreate={handleCreateCustomer} />
                    </div>
                ) : activeView === 'settings' ? (
                    <div>
                        <SettingsView />
                    </div>
                ) : (
                    <p>Select a menu option from the left.</p>
                )}
            </main>
        </div>
    );
}

export default App;
