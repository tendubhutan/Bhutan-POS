const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const script = `
    <script>
      window.addEventListener('error', function(e) {
        document.body.innerHTML += '<div style="color:red; z-index:9999; position:absolute; top:0; left:0; background:white; padding:20px; width:100%; height:100%;">' + e.error.stack.replace(/\\n/g, '<br>') + '</div>';
      });
    </script>
`;

if (!html.includes('window.addEventListener')) {
  html = html.replace('</head>', script + '</head>');
  fs.writeFileSync('index.html', html);
}
