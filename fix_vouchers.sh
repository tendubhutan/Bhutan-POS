#!/bin/bash
sed -i 's/isEdit: isEditingThis,/originalVoucherNo: editingVoucherNo || undefined,\n        isEdit: isEditingThis || Boolean(editingVoucherNo),/g' src/components/Vouchers.tsx
