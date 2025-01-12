import React, { useState } from 'react';
import CustomerForm from './CustomerForm';

interface Customer {
    id: string;
    name: string;
    email: string;
}

interface CustomerViewProps {
    customers: Customer[];
    onCreate: (name: string, email: string, independent: boolean) => void;
}

const CustomersView: React.FC<CustomerViewProps> = ({ customers, onCreate }) => {
    const [showForm, setShowForm] = useState(false);

    const toggleForm = () => setShowForm(!showForm);

    const handleCreateCustomer = async (
        name: string,
        email: string,
        independent: boolean
    ) => {
        onCreate(name, email, independent);
        setShowForm(false);
    };

    return (
        <div className="customers-view">
            {/* If showForm is true, we ONLY render the form */}
            {showForm ? (
                <>
                    <h3>Create Customer</h3>

                    <CustomerForm onCreate={handleCreateCustomer} />

                    {/* “Close” or “X” button, or the same toggle button switching icons */}
                    <button
                        onClick={toggleForm}
                        className="close-form-button"
                        aria-label="Close form"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </>
            ) : (
                <>
                    <h3>Customers</h3>

                    {/* Show the list when not in form mode */}
                    {customers.length === 0 ? (
                        <p>No customers found.</p>
                    ) : (
                        <ul>
                            {customers.map((c) => (
                                <li key={c.id}>
                                    {c.name} - {c.email}
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* “Add” or “+” button to show the form */}
                    <button
                        onClick={toggleForm}
                        className="add-customer-button"
                        aria-label="Add Customer"
                    >
                        <i className="fa-solid fa-plus"></i>
                    </button>
                </>
            )}
        </div>
    );
};

export default CustomersView;
