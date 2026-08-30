import React from 'react';

export interface GridNavParams {
  prefix: string; // e.g. 'sale', 'pur', 'qt', 'dn', 'cn', 'debit', 'stock', 'pos'
  idx: number;
  field: 'item' | 'qty' | 'rate' | 'disc' | 'gst';
  totalRows: number;
  searchPickerId?: string; // ID of search input box to jump back to
  hasDiscount?: boolean;
  hasGst?: boolean;
  onDeleteRow?: (idx: number) => void;
  onAddNewRow?: () => void;
  onOpenNewItemModal?: () => void;
  onEditItem?: (idx: number) => void;
  onShowInfo?: (idx: number) => void;
  onSaveVoucher?: () => void;
  dateInputId?: string;
}

export function handleGridKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>,
  params: GridNavParams
) {
  const {
    prefix,
    idx,
    field,
    totalRows,
    searchPickerId,
    hasDiscount = true,
    hasGst = false,
    onDeleteRow,
    onAddNewRow,
    onOpenNewItemModal,
    onEditItem,
    onShowInfo,
    onSaveVoucher,
    dateInputId
  } = params;

  const focusAndSelect = (targetId: string) => {
    setTimeout(() => {
      const el = document.getElementById(targetId) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (typeof el.select === 'function') {
          el.select();
        }
      }
    }, 10);
  };

  // 1. Save Voucher (Ctrl + A or F2)
  const isCtrlA = (e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A');
  const isF2 = e.key === 'F2';
  if (isCtrlA || isF2) {
    if (onSaveVoucher) {
      e.preventDefault();
      e.stopPropagation();
      onSaveVoucher();
      return;
    }
  }

  // 2. Item/Ledger Info Details (F7, Ctrl + I, or Alt + I)
  const isF7 = e.key === 'F7';
  const isCtrlI = (e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I');
  const isAltI = e.altKey && (e.key === 'i' || e.key === 'I');
  if (isF7 || isCtrlI || isAltI) {
    if (onShowInfo) {
      e.preventDefault();
      e.stopPropagation();
      onShowInfo(idx);
      return;
    }
  }

  // 3. Create Item Master (Alt + C)
  if (e.altKey && (e.key === 'c' || e.key === 'C')) {
    if (onOpenNewItemModal) {
      e.preventDefault();
      e.stopPropagation();
      onOpenNewItemModal();
      return;
    }
  }

  // 4. Alter/Edit Item Master (Ctrl + Enter)
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (onEditItem) {
      e.preventDefault();
      e.stopPropagation();
      onEditItem(idx);
      return;
    }
  }

  // 5. Delete Line Item Row (Alt + D or Delete key on empty field / selected row)
  const isAltD = e.altKey && (e.key === 'd' || e.key === 'D');
  const isDeleteKey = e.key === 'Delete';
  if (isAltD || isDeleteKey) {
    if (onDeleteRow) {
      e.preventDefault();
      e.stopPropagation();
      onDeleteRow(idx);
      setTimeout(() => {
        if (idx < totalRows - 1) {
          focusAndSelect(`${prefix}-item-${idx}`);
        } else if (idx > 0) {
          focusAndSelect(`${prefix}-item-${idx - 1}`);
        } else if (searchPickerId) {
          focusAndSelect(searchPickerId);
        }
      }, 30);
      return;
    }
  }

  // 6. Enter Key Flow (Navigation / Row Advance)
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    if (field === 'item') {
      focusAndSelect(`${prefix}-qty-${idx}`);
    } else if (field === 'qty') {
      focusAndSelect(`${prefix}-rate-${idx}`);
    } else if (field === 'rate') {
      if (hasDiscount) {
        focusAndSelect(`${prefix}-disc-${idx}`);
      } else if (hasGst) {
        focusAndSelect(`${prefix}-gst-${idx}`);
      } else if (idx < totalRows - 1) {
        focusAndSelect(`${prefix}-item-${idx + 1}`);
      } else if (onAddNewRow) {
        onAddNewRow();
      } else if (searchPickerId) {
        focusAndSelect(searchPickerId);
      }
    } else if (field === 'disc') {
      if (hasGst) {
        focusAndSelect(`${prefix}-gst-${idx}`);
      } else if (idx < totalRows - 1) {
        focusAndSelect(`${prefix}-item-${idx + 1}`);
      } else if (onAddNewRow) {
        onAddNewRow();
      } else if (searchPickerId) {
        focusAndSelect(searchPickerId);
      }
    } else if (field === 'gst') {
      if (idx < totalRows - 1) {
        focusAndSelect(`${prefix}-item-${idx + 1}`);
      } else if (onAddNewRow) {
        onAddNewRow();
      } else if (searchPickerId) {
        focusAndSelect(searchPickerId);
      }
    }
    return;
  }

  // 7. Arrow Navigation (Left/Right/Up/Down)
  if (e.key === 'ArrowRight') {
    const target = e.currentTarget;
    const isAtEnd = target.selectionStart === target.value.length;
    const isAllSelected = target.selectionStart === 0 && target.selectionEnd === target.value.length;
    if (isAtEnd || isAllSelected || target.value === '') {
      e.preventDefault();
      if (field === 'item') {
        focusAndSelect(`${prefix}-qty-${idx}`);
      } else if (field === 'qty') {
        focusAndSelect(`${prefix}-rate-${idx}`);
      } else if (field === 'rate') {
        if (hasDiscount) focusAndSelect(`${prefix}-disc-${idx}`);
        else if (hasGst) focusAndSelect(`${prefix}-gst-${idx}`);
      } else if (field === 'disc') {
        if (hasGst) focusAndSelect(`${prefix}-gst-${idx}`);
      }
    }
  } else if (e.key === 'ArrowLeft') {
    const target = e.currentTarget;
    const isAtStart = target.selectionStart === 0;
    const isAllSelected = target.selectionStart === 0 && target.selectionEnd === target.value.length;
    if (isAtStart || isAllSelected || target.value === '') {
      e.preventDefault();
      if (field === 'rate') {
        focusAndSelect(`${prefix}-qty-${idx}`);
      } else if (field === 'disc') {
        focusAndSelect(`${prefix}-rate-${idx}`);
      } else if (field === 'gst') {
        if (hasDiscount) focusAndSelect(`${prefix}-disc-${idx}`);
        else focusAndSelect(`${prefix}-rate-${idx}`);
      }
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (idx < totalRows - 1) {
      focusAndSelect(`${prefix}-${field}-${idx + 1}`);
    } else if (searchPickerId) {
      focusAndSelect(searchPickerId);
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (idx > 0) {
      focusAndSelect(`${prefix}-${field}-${idx - 1}`);
    } else if (searchPickerId) {
      focusAndSelect(searchPickerId);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    if (searchPickerId) {
      focusAndSelect(searchPickerId);
    }
  }
}

