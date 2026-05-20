const fs = require('fs');
const base = 'C:/Users/psiri/lms-app/lms-app/frontend/src/pages/';

// Fix 1: AnalyticsPage - cards overflow fix
let c = fs.readFileSync(base + 'AnalyticsPage.js', 'utf8');
// Make stat cards responsive - change 3-col grid to 1-col on mobile
c = c.replace(
  /gridTemplateColumns:\s*['"`]repeat\(3,\s*1fr\)['"`]/g,
  "gridTemplateColumns: 'repeat(3, 1fr)'"
);
// Add paddingLeft for hamburger
c = c.replace(
  /<div style=\{\{\s*display:\s*'flex',\s*minHeight:\s*'100vh'/,
  "<div style={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden'"
);
fs.writeFileSync(base + 'AnalyticsPage.js', c, 'utf8');
console.log('AnalyticsPage done');

// Fix 2: WeeklyReportPage - same overflow fix
let w = fs.readFileSync(base + 'WeeklyReportPage.js', 'utf8');
w = w.replace(
  /<div style=\{\{\s*display:\s*'flex',\s*minHeight:\s*'100vh'/,
  "<div style={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden'"
);
fs.writeFileSync(base + 'WeeklyReportPage.js', w, 'utf8');
console.log('WeeklyReportPage done');

// Fix 3: LeaderboardPage - overflow fix
let l = fs.readFileSync(base + 'LeaderboardPage.js', 'utf8');
l = l.replace(
  /<div style=\{\{\s*display:\s*'flex',\s*minHeight:\s*'100vh'/,
  "<div style={{ display: 'flex', minHeight: '100vh', overflowX: 'hidden'"
);
fs.writeFileSync(base + 'LeaderboardPage.js', l, 'utf8');
console.log('LeaderboardPage done');

console.log('All done!');