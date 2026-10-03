import React from 'react';

export interface GridNavParams {
  prefix: string; // e.g. 'sale', 'pur', 'qt', 'dn', 'cn', 'debit', 'stock', 'pos'
  idx: number;
  field: 'item' | 'qty' | 'rate' | 'disc' | 'gst';
  totalRows: number;
  searchPickerId?: string; // ID of search input box to jump back to
  hasRate?: boolean;
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

export function focusAndSelect(targetId: string | HTMLElement | null) {
  if (!targetId) return;
  const el = typeof targetId === 'string' ? document.getElementById(targetId) : targetId;
  if (!el) return;

  const doFocus = () => {
    try {
      (el as HTMLElement).focus();
      (el as HTMLElement).scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      if (typeof (el as HTMLInputElement).select === 'function') {
        (el as HTMLInputElement).select();
      }
    } catch {
      // Ignore errors on non-text/special elements
    }
  };

  // Immediate synchronous focus
  doFocus();
  // Microtask / small timeout fallback in case of React state batching
  setTimeout(doFocus, 15);
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
    hasRate = true,
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
      const hasRateEl = hasRate && !!document.getElementById(`${prefix}-rate-${idx}`);
      const hasDiscEl = hasDiscount && !!document.getElementById(`${prefix}-disc-${idx}`);
      const hasGstEl = hasGst && !!document.getElementById(`${prefix}-gst-${idx}`);

      if (hasRateEl) {
        focusAndSelect(`${prefix}-rate-${idx}`);
      } else if (hasDiscEl) {
        focusAndSelect(`${prefix}-disc-${idx}`);
      } else if (hasGstEl) {
        focusAndSelect(`${prefix}-gst-${idx}`);
      } else if (idx < totalRows - 1) {
        focusAndSelect(`${prefix}-item-${idx + 1}`);
      } else if (onAddNewRow) {
        onAddNewRow();
      } else if (searchPickerId && !!document.getElementById(searchPickerId)) {
        focusAndSelect(searchPickerId);
      } else if (!!document.getElementById(`${prefix}-narration`)) {
        focusAndSelect(`${prefix}-narration`);
      } else if (!!document.getElementById(`${prefix}-save-btn`)) {
        focusAndSelect(`${prefix}-save-btn`);
      }
    } else if (field === 'rate') {
      const hasDiscEl = hasDiscount && !!document.getElementById(`${prefix}-disc-${idx}`);
      const hasGstEl = hasGst && !!document.getElementById(`${prefix}-gst-${idx}`);

      if (hasDiscEl) {
        focusAndSelect(`${prefix}-disc-${idx}`);
      } else if (hasGstEl) {
        focusAndSelect(`${prefix}-gst-${idx}`);
      } else if (idx < totalRows - 1) {
        focusAndSelect(`${prefix}-item-${idx + 1}`);
      } else if (onAddNewRow) {
        onAddNewRow();
      } else if (searchPickerId && !!document.getElementById(searchPickerId)) {
        focusAndSelect(searchPickerId);
      } else if (!!document.getElementById(`${prefix}-narration`)) {
        focusAndSelect(`${prefix}-narration`);
      } else if (!!document.getElementById(`${prefix}-save-btn`)) {
        focusAndSelect(`${prefix}-save-btn`);
      }
    } else if (field === 'disc') {
      const hasGstEl = hasGst && !!document.getElementById(`${prefix}-gst-${idx}`);

      if (hasGstEl) {
        focusAndSelect(`${prefix}-gst-${idx}`);
      } else if (idx < totalRows - 1) {
        focusAndSelect(`${prefix}-item-${idx + 1}`);
      } else if (onAddNewRow) {
        onAddNewRow();
      } else if (searchPickerId && !!document.getElementById(searchPickerId)) {
        focusAndSelect(searchPickerId);
      } else if (!!document.getElementById(`${prefix}-narration`)) {
        focusAndSelect(`${prefix}-narration`);
      } else if (!!document.getElementById(`${prefix}-save-btn`)) {
        focusAndSelect(`${prefix}-save-btn`);
      }
    } else if (field === 'gst') {
      if (idx < totalRows - 1) {
        focusAndSelect(`${prefix}-item-${idx + 1}`);
      } else if (onAddNewRow) {
        onAddNewRow();
      } else if (searchPickerId && !!document.getElementById(searchPickerId)) {
        focusAndSelect(searchPickerId);
      } else if (!!document.getElementById(`${prefix}-narration`)) {
        focusAndSelect(`${prefix}-narration`);
      } else if (!!document.getElementById(`${prefix}-save-btn`)) {
        focusAndSelect(`${prefix}-save-btn`);
      }
    }
    return;
  }

  // 7. Arrow Navigation (Left/Right/Up/Down) - Matches POS Billing experience
  if (e.key === 'ArrowRight') {
    const target = e.currentTarget;
    let shouldAdvance = true;

    // For text inputs (e.g. search / item code), only advance if cursor is at the end or empty/selected
    if (target && target.type !== 'number') {
      try {
        if (typeof target.selectionStart === 'number' && typeof target.selectionEnd === 'number') {
          const valLen = target.value ? target.value.length : 0;
          const isAtEnd = target.selectionStart === valLen;
          const isAllSelected = target.selectionStart === 0 && target.selectionEnd === valLen;
          shouldAdvance = isAtEnd || isAllSelected || valLen === 0;
        }
      } catch {
        shouldAdvance = true;
      }
    }

    if (shouldAdvance) {
      e.preventDefault();
      e.stopPropagation();

      if (field === 'item') {
        focusAndSelect(`${prefix}-qty-${idx}`);
      } else if (field === 'qty') {
        const hasRateEl = hasRate && !!document.getElementById(`${prefix}-rate-${idx}`);
        const hasDiscEl = hasDiscount && !!document.getElementById(`${prefix}-disc-${idx}`);
        const hasGstEl = hasGst && !!document.getElementById(`${prefix}-gst-${idx}`);

        if (hasRateEl) {
          focusAndSelect(`${prefix}-rate-${idx}`);
        } else if (hasDiscEl) {
          focusAndSelect(`${prefix}-disc-${idx}`);
        } else if (hasGstEl) {
          focusAndSelect(`${prefix}-gst-${idx}`);
        } else if (idx < totalRows - 1) {
          focusAndSelect(`${prefix}-item-${idx + 1}`);
        } else if (searchPickerId && !!document.getElementById(searchPickerId)) {
          focusAndSelect(searchPickerId);
        }
      } else if (field === 'rate') {
        const hasDiscEl = hasDiscount && !!document.getElementById(`${prefix}-disc-${idx}`);
        const hasGstEl = hasGst && !!document.getElementById(`${prefix}-gst-${idx}`);

        if (hasDiscEl) {
          focusAndSelect(`${prefix}-disc-${idx}`);
        } else if (hasGstEl) {
          focusAndSelect(`${prefix}-gst-${idx}`);
        } else if (idx < totalRows - 1) {
          focusAndSelect(`${prefix}-item-${idx + 1}`);
        } else if (searchPickerId && !!document.getElementById(searchPickerId)) {
          focusAndSelect(searchPickerId);
        }
      } else if (field === 'disc') {
        const hasGstEl = hasGst && !!document.getElementById(`${prefix}-gst-${idx}`);

        if (hasGstEl) {
          focusAndSelect(`${prefix}-gst-${idx}`);
        } else if (idx < totalRows - 1) {
          focusAndSelect(`${prefix}-item-${idx + 1}`);
        } else if (searchPickerId && !!document.getElementById(searchPickerId)) {
          focusAndSelect(searchPickerId);
        }
      } else if (field === 'gst') {
        if (idx < totalRows - 1) {
          focusAndSelect(`${prefix}-item-${idx + 1}`);
        } else if (searchPickerId && !!document.getElementById(searchPickerId)) {
          focusAndSelect(searchPickerId);
        }
      }
    }
  } else if (e.key === 'ArrowLeft') {
    const target = e.currentTarget;
    let shouldRetreat = true;

    // For text inputs, only retreat if cursor is at the beginning or empty/selected
    if (target && target.type !== 'number') {
      try {
        if (typeof target.selectionStart === 'number' && typeof target.selectionEnd === 'number') {
          const valLen = target.value ? target.value.length : 0;
          const isAtStart = target.selectionStart === 0;
          const isAllSelected = target.selectionStart === 0 && target.selectionEnd === valLen;
          shouldRetreat = isAtStart || isAllSelected || valLen === 0;
        }
      } catch {
        shouldRetreat = true;
      }
    }

    if (shouldRetreat) {
      e.preventDefault();
      e.stopPropagation();

      if (field === 'gst') {
        const hasDiscEl = hasDiscount && !!document.getElementById(`${prefix}-disc-${idx}`);
        const hasRateEl = hasRate && !!document.getElementById(`${prefix}-rate-${idx}`);

        if (hasDiscEl) {
          focusAndSelect(`${prefix}-disc-${idx}`);
        } else if (hasRateEl) {
          focusAndSelect(`${prefix}-rate-${idx}`);
        } else {
          focusAndSelect(`${prefix}-qty-${idx}`);
        }
      } else if (field === 'disc') {
        const hasRateEl = hasRate && !!document.getElementById(`${prefix}-rate-${idx}`);

        if (hasRateEl) {
          focusAndSelect(`${prefix}-rate-${idx}`);
        } else {
          focusAndSelect(`${prefix}-qty-${idx}`);
        }
      } else if (field === 'rate') {
        focusAndSelect(`${prefix}-qty-${idx}`);
      } else if (field === 'qty') {
        const itemEl = document.getElementById(`${prefix}-item-${idx}`);
        if (itemEl) {
          focusAndSelect(`${prefix}-item-${idx}`);
        } else if (searchPickerId && !!document.getElementById(searchPickerId)) {
          focusAndSelect(searchPickerId);
        }
      } else if (field === 'item') {
        // From item, Left Arrow can go to previous row's last field
        if (idx > 0) {
          const prevGst = hasGst && document.getElementById(`${prefix}-gst-${idx - 1}`);
          const prevDisc = hasDiscount && document.getElementById(`${prefix}-disc-${idx - 1}`);
          const prevRate = hasRate && document.getElementById(`${prefix}-rate-${idx - 1}`);
          if (prevGst) {
            focusAndSelect(`${prefix}-gst-${idx - 1}`);
          } else if (prevDisc) {
            focusAndSelect(`${prefix}-disc-${idx - 1}`);
          } else if (prevRate) {
            focusAndSelect(`${prefix}-rate-${idx - 1}`);
          } else {
            focusAndSelect(`${prefix}-qty-${idx - 1}`);
          }
        }
      }
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (idx < totalRows - 1) {
      focusAndSelect(`${prefix}-${field}-${idx + 1}`);
    } else if (searchPickerId && !!document.getElementById(searchPickerId)) {
      focusAndSelect(searchPickerId);
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (idx > 0) {
      focusAndSelect(`${prefix}-${field}-${idx - 1}`);
    } else if (searchPickerId && !!document.getElementById(searchPickerId)) {
      focusAndSelect(searchPickerId);
    }
  }
}

