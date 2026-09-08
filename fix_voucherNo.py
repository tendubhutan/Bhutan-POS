import sys
with open('src/services/storageService.ts', 'r') as f:
    lines = f.readlines()

for i in range(3560, 3580):
    if "voucherNo: no," in lines[i] and "type: 'CN'," in lines[i+2]:
        lines[i] = lines[i].replace("voucherNo: no,", "voucherNo: finalNoCN,")
        break

for i in range(3670, 3695):
    if "voucherNo: no," in lines[i] and "type: 'DN'," in lines[i+2]:
        lines[i] = lines[i].replace("voucherNo: no,", "voucherNo: finalNo,")
        break

with open('src/services/storageService.ts', 'w') as f:
    f.writelines(lines)
