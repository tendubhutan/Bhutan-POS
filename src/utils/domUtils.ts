export function focusNextOutsideGrid(currentElementId: string) {
  const current = document.getElementById(currentElementId);
  if (!current) return;
  const table = current.closest('table');
  if (!table) return;

  const focusableEls = document.querySelectorAll(
    'input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  
  let foundTable = false;
  for (let i = 0; i < focusableEls.length; i++) {
    const el = focusableEls[i];
    if (table.contains(el)) {
      foundTable = true;
    } else if (foundTable) {
      // We are past the table! Find the first visible one.
      const htmlEl = el as HTMLElement;
      if (htmlEl.offsetWidth > 0 || htmlEl.offsetHeight > 0) {
        htmlEl.focus();
        return;
      }
    }
  }
}
