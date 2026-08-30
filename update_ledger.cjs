const fs = require('fs');
let code = fs.readFileSync('src/components/SearchableLedgerSelect.tsx', 'utf8');

if (!code.includes('createPortal')) {
  code = code.replace(/import React(.*?);/, "import React$1;\nimport { createPortal } from 'react-dom';");
  
  // replace container ref setup with smart portal placement
  code = code.replace(/const containerRef = useRef<HTMLDivElement>\(null\);/, `const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, placement: 'bottom' });

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - rect.bottom;
        const spaceAbove = rect.top;
        const dropdownHeight = 300;
        
        let placement = 'bottom';
        if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
          placement = 'top';
        }

        setCoords({
          top: placement === 'bottom' ? rect.bottom + 4 : rect.top - 4,
          left: rect.left,
          width: Math.max(rect.width, 300),
          placement
        });
      };
      
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen]);`);

  // replace the dropdown render
  code = code.replace(/\{isOpen && \([\s\S]*?<div\s+ref=\{listRef\}\s+className=\{`absolute[^>]+>\s*([\s\S]*?)<\/div>\s*\)\}/, 
  `{isOpen && typeof document !== 'undefined' && createPortal(
    <div
      ref={listRef}
      style={{
        position: 'fixed',
        top: coords.placement === 'bottom' ? coords.top : 'auto',
        bottom: coords.placement === 'top' ? window.innerHeight - coords.top : 'auto',
        left: coords.left,
        width: coords.width,
        zIndex: 99999
      }}
      className={\`max-h-[300px] overflow-y-auto rounded-xl border border-slate-300 bg-white p-0 shadow-2xl animate-in fade-in zoom-in-95 duration-100 origin-\${coords.placement === 'bottom' ? 'top' : 'bottom'}\`}
    >
      $1
    </div>, document.body
  )}`);

  // adjust the click outside to check the portal
  code = code.replace(/if \(containerRef\.current && !containerRef\.current\.contains\(e\.target as Node\)\) \{/, 
  `if (
        containerRef.current && 
        !containerRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {`);

  fs.writeFileSync('src/components/SearchableLedgerSelect.tsx', code);
}
