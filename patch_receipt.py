import re

with open("src/components/ThermalReceiptModal.tsx", "r") as f:
    content = f.read()

# Add Order No and Delivery Note in Customer Details section
cust_section = """              {/* Customer Details */}
              <div className="text-xs mb-3 space-y-0.5">
                {invoice.customer.name && <div className="font-bold">To: {invoice.customer.name}</div>}
                {invoice.customer.phone && <div>Ph: {invoice.customer.phone}</div>}
                {invoice.customer.gstNo && <div>GST No: {invoice.customer.gstNo}</div>}
                {invoice.orderNo && <div>Order No: {invoice.orderNo} {invoice.orderDate && `Dt: ${invoice.orderDate}`}</div>}
                {invoice.deliveryNoteNo && <div>Delivery Note: {invoice.deliveryNoteNo}</div>}
              </div>"""
              
content = re.sub(r'\{\/\* Customer Details \*\/\}.*?<\/div>', cust_section, content, flags=re.DOTALL)

# Add Receiver Signature and Custom Terms at the Footer
# Let's see how footer is structured
footer_replacement = """              {/* Terms and Signatures */}
              <div className="mt-8 border-t border-dashed border-slate-300 pt-3">
                <div className="text-[10px] text-left mb-6 whitespace-pre-wrap">
                  {invoice.termsAndConditions || config.FooterTerms || 'Thank you for your business!'}
                </div>
                
                <div className="flex justify-between items-end mt-8">
                  <div className="text-center">
                    <div className="w-24 border-b border-black mb-1"></div>
                    <div className="text-[10px] font-bold">Receiver's Signature</div>
                  </div>
                  <div className="text-center">
                    {config.ReceiptSignatureImage ? (
                      <img src={config.ReceiptSignatureImage} alt="Signature" className="h-8 object-contain mx-auto mb-1 grayscale" />
                    ) : (
                      <div className="w-24 border-b border-black mb-1 mt-8"></div>
                    )}
                    <div className="text-[10px] font-bold">Authorized Signatory</div>
                  </div>
                </div>
              </div>
            </div>"""

content = re.sub(r'\{\/\* Footer Terms \*\/\}.*?<\/div>.*?<\/div>', footer_replacement, content, flags=re.DOTALL)

with open("src/components/ThermalReceiptModal.tsx", "w") as f:
    f.write(content)
