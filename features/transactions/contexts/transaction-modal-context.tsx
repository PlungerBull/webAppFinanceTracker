'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { AddTransactionModal } from '../components/add-transaction-modal';

interface TransactionModalContextType {
    isOpen: boolean;
    openTransactionModal: () => void;
    closeTransactionModal: () => void;
}

const TransactionModalContext = createContext<TransactionModalContextType | undefined>(
    undefined
);

export function TransactionModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);

    const openTransactionModal = () => setIsOpen(true);
    const closeTransactionModal = () => setIsOpen(false);

    return (
        <TransactionModalContext.Provider
            value={{
                isOpen,
                openTransactionModal,
                closeTransactionModal,
            }}
        >
            {children}
            <AddTransactionModal open={isOpen} onOpenChange={setIsOpen} />
        </TransactionModalContext.Provider>
    );
}

export function useTransactionModal() {
    const context = useContext(TransactionModalContext);
    if (context === undefined) {
        throw new Error('useTransactionModal must be used within a TransactionModalProvider');
    }
    return context;
}
