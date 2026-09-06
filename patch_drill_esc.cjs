const fs = require('fs');
const file = 'src/components/DrillModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "    const handleAppBack = (e: CustomEvent) => {\n      e.preventDefault();\n      e.stopPropagation();\n      if (showCancelModal || showDeleteModal || showShareModal || showReceiptModal) {\n        resetActionModals();\n        return;\n      }\n      handleBack();\n    };\n\n    window.addEventListener('app:back' as any, handleAppBack);\n    return () => window.removeEventListener('app:back' as any, handleAppBack);\n  }, [active, history, showCancelModal, showDeleteModal, showShareModal, showReceiptModal, onClose]);",
  "    const handleAppBack = (e: CustomEvent) => {\n      e.preventDefault();\n      e.stopPropagation();\n      if (showChangePeriodModal) {\n        setShowChangePeriodModal(false);\n        return;\n      }\n      if (showCancelModal || showDeleteModal || showShareModal || showReceiptModal) {\n        resetActionModals();\n        return;\n      }\n      handleBack();\n    };\n\n    window.addEventListener('app:back' as any, handleAppBack);\n    return () => window.removeEventListener('app:back' as any, handleAppBack);\n  }, [active, history, showCancelModal, showDeleteModal, showShareModal, showReceiptModal, showChangePeriodModal, onClose]);"
);

content = content.replace(
  "      if (e.key === 'Escape') {\n        e.preventDefault();\n        e.stopPropagation();\n        e.stopImmediatePropagation?.();\n        if (showCancelModal || showDeleteModal || showShareModal || showReceiptModal) {\n          resetActionModals();\n          return;\n        }\n        handleBack();\n      }\n    };\n    window.addEventListener('keydown', handleKeyDown, true);\n    return () => window.removeEventListener('keydown', handleKeyDown, true);\n  }, [active, history, showCancelModal, showDeleteModal, showShareModal, showReceiptModal, onClose]);",
  "      if (e.key === 'Escape') {\n        e.preventDefault();\n        e.stopPropagation();\n        e.stopImmediatePropagation?.();\n        if (showChangePeriodModal) {\n          setShowChangePeriodModal(false);\n          return;\n        }\n        if (showCancelModal || showDeleteModal || showShareModal || showReceiptModal) {\n          resetActionModals();\n          return;\n        }\n        handleBack();\n      }\n    };\n    window.addEventListener('keydown', handleKeyDown, true);\n    return () => window.removeEventListener('keydown', handleKeyDown, true);\n  }, [active, history, showCancelModal, showDeleteModal, showShareModal, showReceiptModal, showChangePeriodModal, onClose]);"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Patched DrillModal Esc handling');
