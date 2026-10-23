import React from 'react';
import { ReceiptList } from '../features/receipts/ReceiptList';
import { ReceiptDetails } from '../features/receipts/ReceiptDetails';
import { ReceiptForm } from '../features/receipts/ReceiptForm';

interface ReceiptsPageProps {
  subView?: 'list' | 'details' | 'edit';
  selectedReceiptId?: string | null;
  onSelectReceipt: (receiptId: string) => void;
  onEditReceipt: (receiptId: string) => void;
  onCreateNew: () => void;
  onSavedReceipt: (receipt: { id: string; receiptNumber?: string }) => void;
  onReceiptDeleted: () => void;
  onBackToList: () => void;
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
  if (subView === 'details' && selectedReceiptId) {
    return (
      <ReceiptDetails
        receiptId={selectedReceiptId}
        onBack={onBackToList}
        onEdit={onEditReceipt}
        onReceiptDeleted={onReceiptDeleted}
      />
    );
  }

  if (subView === 'edit' && selectedReceiptId) {
    return (
      <ReceiptForm
        receiptId={selectedReceiptId}
        onSaved={onSavedReceipt}
        onCancel={() => onSelectReceipt(selectedReceiptId)}
      />
    );
  }

  return (
    <ReceiptList
      onSelectReceipt={onSelectReceipt}
      onEditReceipt={onEditReceipt}
      onCreateNew={onCreateNew}
    />
  );
};
