import re
import glob

for filepath in glob.glob("src/components/vouchers/*.tsx") + ["src/components/POSBilling.tsx"]:
    with open(filepath, "r") as f:
        content = f.read()
    
    # Remove Code: {line.itemCode}
    content = re.sub(r'<div className="text-\[10px\] text-slate-400">Code: \{line\.itemCode\}</div>', '', content)
    content = re.sub(r'Code: \{item\[\'Item Code\'\]\}.*?BC: \{item\.Barcode\} \? \'\'\}', '', content)
    content = re.sub(r'Code: \{item\[\'Item Code\'\]\} \{item\.Barcode \? `\| BC: \$\{item\.Barcode\}` : \'\'\}', '', content)
    
    with open(filepath, "w") as f:
        f.write(content)

