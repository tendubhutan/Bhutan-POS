#!/bin/bash
sed -i 's/voucherNo?: string;/voucherNo?: string;\n  originalVoucherNo?: string;/g' src/services/storageService.ts
