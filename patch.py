import sys
with open('src/components/SalesInvoiceEntry.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    '  const itemInputRef = useRef<HTMLInputElement>(null);\n\n  const showSerials',
    '  const itemInputRef = useRef<HTMLInputElement>(null);\n  const cartScrollRef = useRef<HTMLDivElement>(null);\n\n  useEffect(() => {\n    if (cartScrollRef.current) {\n      cartScrollRef.current.scrollTop = cartScrollRef.current.scrollHeight;\n    }\n  }, [cart.length]);\n\n  const showSerials'
)

content = content.replace(
    '<div className="flex-1 min-h-0 overflow-y-auto rounded-b-xl">',
    '<div className="flex-1 min-h-0 overflow-y-auto rounded-b-xl scroll-smooth" ref={cartScrollRef}>'
)

with open('src/components/SalesInvoiceEntry.tsx', 'w') as f:
    f.write(content)
