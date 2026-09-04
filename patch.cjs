const fs = require('fs');
let content = fs.readFileSync('src/components/Vouchers.tsx', 'utf8');

content = content.replace(
`        setNarration('');
        handleVTypeChange(activeVType);
      }
    } else {`,
`        setNarration('');
        handleVTypeChange(activeVType);
        
        if (action === 'share') {
          setViewVoucher(savedObj);
        }
      }
    } else {`
);

content = content.replace(
`        setTransactionId('');
        handleVTypeChange(activeVType);
      } else {
        alert(result.error || 'Failed to save voucher');
      }
    }
  };`,
`        setTransactionId('');
        handleVTypeChange(activeVType);
        
        if (action === 'share') {
          setViewVoucher(savedObj);
        }
      } else {
        alert(result.error || 'Failed to save voucher');
      }
    }
  };`
);

fs.writeFileSync('src/components/Vouchers.tsx', content);
