import re

with open("src/components/PurchaseEntry.tsx", "r") as f:
    content = f.read()

old_table = r"""          <table className="w-full border-collapse text-xs sm:text-sm table-fixed">
            <colgroup>
              <col style=\{\{ width: showItemDiscount \? '30%' : '44%' \}\} />
              <col style=\{\{ width: '8%' \}\} />
              <col style=\{\{ width: '8%' \}\} />
              <col style=\{\{ width: '10%' \}\} />
              \{showItemDiscount && <col style=\{\{ width: '14%' \}\} />\}
              <col style=\{\{ width: '10%' \}\} />
              <col style=\{\{ width: '14%' \}\} />
              <col style=\{\{ width: '6%' \}\} />
            </colgroup>"""
new_table = """          <table className="w-full border-collapse text-xs sm:text-sm">"""
content = re.sub(old_table, new_table, content)

with open("src/components/PurchaseEntry.tsx", "w") as f:
    f.write(content)
