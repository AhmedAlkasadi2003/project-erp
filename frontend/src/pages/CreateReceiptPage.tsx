import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ReceiptForm } from '../features/receipts/ReceiptForm';

interface CreateReceiptPageProps {
  onSaved?: (receipt: { id: string; receiptNumber?: string }) => void;
  onCancel?: () => void;
}

export const CreateReceiptPage: React.FC<CreateReceiptPageProps> = ({ onSaved, onCancel }) => {
  const navigate = useNavigate();

  const handleSaved = (receipt: { id: string; receiptNumber?: string }) => {
    if (onSaved) {
      onSaved(receipt);
    } else {
      navigate(`/receipts/${receipt.id}`);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate('/receipts');
    }
  };

  return <ReceiptForm onSaved={handleSaved} onCancel={handleCancel} />;
};
