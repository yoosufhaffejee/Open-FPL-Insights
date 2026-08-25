const fs = require('fs');
function fix_file(filepath) {
    let content = fs.readFileSync(filepath, 'utf8');
    let start = content.indexOf('function populatePlayerModal(');
    let end = content.indexOf('function ', start + 10);
    if (end === -1) end = content.length;
    let modal_func = content.substring(start, end);
    modal_func = modal_func.replace(/selectedGameweek/g, "(typeof selectedGameweek !== 'undefined' ? selectedGameweek : getUpcomingGameweek().id)");
    let new_content = content.substring(0, start) + modal_func + content.substring(end);
    fs.writeFileSync(filepath, new_content, 'utf8');
}
fix_file('pages/planner/planner.js');
fix_file('pages/fixtures/fixtures.js');
console.log('Fixed selectedGameweek');
