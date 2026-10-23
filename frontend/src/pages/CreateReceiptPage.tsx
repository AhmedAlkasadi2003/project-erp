import React from 'react';
import { ReceiptForm } from '../features/receipts/ReceiptForm';

interface CreateReceiptPageProps {
  onSaved: (receipt: { id: string; receiptNumber?: string }) => void;
  onCancel: () => void;
}

export const CreateReceiptPage: React.FC<CreateReceiptPageProps> = ({ onSaved, onCancel }) => {
  return <ReceiptForm onSaved={onSaved} onCancel={onCancel} />;
};
