import re

with open("src/components/ThermalReceiptModal.tsx", "r") as f:
    content = f.read()

old_desc = r"""                    \{\(item\.description \|\| item\.Description \|\| item\["Item Description"\]\) \? `<br><small style="color: #475569; font-style: italic;">Desc: \$\{item\.description \|\| item\.Description \|\| item\["Item Description"\]\}</small>` : ''\}"""

new_desc = """                    {(item.description || item.Description || item["Item Description"] || item.lineDescription) ? `<br><small style="color: #475569; font-style: italic;">Desc: ${item.description || item.Description || item["Item Description"] || item.lineDescription}</small>` : ''}"""

content = re.sub(old_desc, new_desc, content)

old_desc_2 = r"""                            \{\(item\.description \|\| item\['Item Description'\]\) && \(
                              <div className="text-\[10px\] text-slate-500 italic">\{item\.description \|\| item\['Item Description'\]\}</div>
                            \)\}"""

new_desc_2 = """                            {(item.description || item.Description || item['Item Description'] || item.lineDescription) && (
                              <div className="text-[10px] text-slate-500 italic">{item.description || item.Description || item['Item Description'] || item.lineDescription}</div>
                            )}"""

content = re.sub(old_desc_2, new_desc_2, content)

with open("src/components/ThermalReceiptModal.tsx", "w") as f:
    f.write(content)
