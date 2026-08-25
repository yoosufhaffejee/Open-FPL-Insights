const fs = require('fs');
let s = fs.readFileSync('pages/planner/planner.js', 'utf8');

s = s.replace(/onclick="selectTransferOut\(\$\{slotId\}, 0\)"/g, "onclick=\"selectTransferOut('${slotId}', 0)\"");
s = s.replace(/onclick="selectTransferOut\(\$\{slotId\}, \$\{gwIndex\}\)"/g, "onclick=\"selectTransferOut('${slotId}', ${gwIndex})\"");
s = s.replace(/onclick="setCaptain\(\$\{slotId\}, true\)"/g, "onclick=\"setCaptain('${slotId}', true)\"");
s = s.replace(/onclick="setCaptain\(\$\{slotId\}, false\)"/g, "onclick=\"setCaptain('${slotId}', false)\"");

fs.writeFileSync('pages/planner/planner.js', s);
console.log('Fixed quotes around slotId');
