import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ReceiptList } from '../features/receipts/ReceiptList';
import { ReceiptDetails } from '../features/receipts/ReceiptDetails';
import { ReceiptForm } from '../features/receipts/ReceiptForm';

interface ReceiptsPageProps {
  subView?: 'list' | 'details' | 'edit';
  selectedReceiptId?: string | null;
  onSelectReceipt?: (receiptId: string) => void;
  onEditReceipt?: (receiptId: string) => void;
  onCreateNew?: () => void;
  onSavedReceipt?: (receipt: { id: string; receiptNumber?: string }) => void;
  onReceiptDeleted?: () => void;
  onBackToList?: () => void;
}

export const ReceiptsPage: React.FC<ReceiptsPageProps> = ({
  subView = 'list',
  selectedReceiptId,
  onSelectReceipt,
  onEditReceipt,
  onCreateNew,
  onSavedReceipt,
  onReceiptDeleted,
  onBackToList,
}) => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();

  const activeId = selectedReceiptId || params.id || null;

  const handleSelect = (id: string) => {
    if (onSelectReceipt) {
      onSelectReceipt(id);
    } else {
      navigate(`/receipts/${id}`);
    }
  };

  const handleEdit = (id: string) => {
    if (onEditReceipt) {
      onEditReceipt(id);
    } else {
      navigate(`/receipts/${id}/edit`);
    }
  };

  const handleCreate = () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      navigate('/receipts/new');
    }
  };

  const handleBack = () => {
    if (onBackToList) {
      onBackToList();
    } else {
      navigate('/receipts');
    }
  };

  const handleSaved = (receipt: { id: string; receiptNumber?: string }) => {
    if (onSavedReceipt) {
      onSavedReceipt(receipt);
    } else {
      navigate(`/receipts/${receipt.id}`);
    }
  };

  const handleDeleted = () => {
    if (onReceiptDeleted) {
      onReceiptDeleted();
    } else {
      navigate('/receipts');
    }
  };

  if (subView === 'details' && activeId) {
    return (
      <ReceiptDetails
        receiptId={activeId}
        onBack={handleBack}
        onEdit={handleEdit}
        onReceiptDeleted={handleDeleted}
      />
    );
  }

  if (subView === 'edit' && activeId) {
    return (
      <ReceiptForm
        receiptId={activeId}
        onSaved={handleSaved}
        onCancel={() => handleSelect(activeId)}
      />
    );
  }

  return (
    <ReceiptList
      onSelectReceipt={handleSelect}
      onEditReceipt={handleEdit}
      onCreateNew={handleCreate}
    />
  );
};
