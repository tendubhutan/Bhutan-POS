const fs = require('fs');
let code = fs.readFileSync('src/components/Reports.tsx', 'utf8');

code = code.replace(
  /                  <option value="gst">GST Summary Report<\/option>/,
  `                  <option value="gst">GST Output (Sales)</option>
                  {config.EnableGSTInputTax === 'true' && (
                    <>
                      <option value="gst_input_dom">GST Input (Domestic Purchase & Expenses)</option>
                      <option value="gst_input_imp">GST Input (Import Purchase)</option>
                    </>
                  )}`
);

fs.writeFileSync('src/components/Reports.tsx', code);
