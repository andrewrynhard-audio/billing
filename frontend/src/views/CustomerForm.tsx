import React, { useState } from 'react';

/**
 * Simple spinner component; replace or style as you wish.
 */
function Spinner() {
    return (
        <div className="loading-indicator">
            <p>Creating customer...</p>
            <div className="spinner"></div>
        </div>
    );
}

interface CustomerFormProps {
    /**
     * The parent must provide an async function that creates
     * a customer in the backend and returns a Promise.
     */
    onCreate: (name: string, email: string, independent: boolean) => Promise<void>;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ onCreate }) => {
    // Basic form fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');

    const [independent, setIndependent] = useState(false);

    /**
     * Track whether we're currently submitting the form (show spinner),
     * and whether the submission succeeded or failed.
     * status can be:
     * - "idle":  default, form not yet submitted
     * - "success": created successfully
     * - "error":  creation failed
     */
    const [isCreating, setIsCreating] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    /**
     * Handle the form submission. We show a spinner,
     * reset success/error states, and attempt the creation.
     */
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Start loading indicator, reset status
        setIsCreating(true);
        setStatus('idle');

        try {
            // Call the parent’s onCreate function
            await onCreate(name, email, independent);

            // If successful, set status to "success"
            setStatus('success');

            // (Optionally) clear the form fields
            setName('');
            setEmail('');
            setIndependent(false);
        } catch (err) {
            console.error('Failed to create customer:', err);
            setStatus('error');
        } finally {
            // Stop showing the spinner, no matter what
            setIsCreating(false);
        }
    };

    return (
        <div>
            {/* If we're currently creating, show the spinner instead of the form */}
            {isCreating ? (
                <div style={{ marginBottom: '1em' }}>
                    <p>Creating customer...</p>
                    <Spinner />
                </div>
            ) : null}

            {/* If status is 'success' or 'error', show a message */}
            {status === 'success' && !isCreating && (
                <div style={{ margin: '1em 0', color: 'green' }}>
                    <p>Customer created successfully!</p>
                </div>
            )}
            {status === 'error' && !isCreating && (
                <div style={{ margin: '1em 0', color: 'red' }}>
                    <p>Failed to create customer. Please try again.</p>
                </div>
            )}

            {/* If we're not creating, show the form.
               Or if you want to hide the form after success, conditionally render. */}
            {!isCreating && (
                <form onSubmit={handleSubmit}>
                    <div>
                        <label>Name:</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label>Email:</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    {/* ---- Replacing the select with a single checkbox ---- */}
                    <div>
                        <label style={{ marginRight: '0.5em' }}>
                            <input
                                type="checkbox"
                                checked={independent === true}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        setIndependent(true);
                                    } else {
                                        setIndependent(false);
                                    }
                                }}
                            />
                            Independent
                        </label>
                    </div>
                    {/* --------------------------------------------- */}

                    <button type="submit">
                        Create Customer
                    </button>
                </form>
            )}
        </div>
    );
};

export default CustomerForm;
