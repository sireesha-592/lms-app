const fs = require('fs');
const pages = ['AnalyticsPage','Attendance','CoursePage','GroupChatPage','LeaderboardPage','MyCourse','NotificationsPage','ProfilePage','WeeklyReportPage'];
const base = 'C:/Users/psiri/lms-app/lms-app/frontend/src/pages/';

pages.forEach(p => {
  const fp = base + p + '.js';
  let c = fs.readFileSync(fp, 'utf8');
  
  const m = c.match(/activePath="([^"]+)"/);
  const ap = m ? m[1] : '/';
  
  // Remove SidebarNav function
  c = c.replace(/const SidebarNav = \(\) => \([\s\S]*?\);\s*/g, '');
  
  // Replace SidebarNav usage with direct Sidebar
  c = c.replace(/<SidebarNav \/>/g, '<Sidebar activePath="' + ap + '" />');
  
  fs.writeFileSync(fp, c, 'utf8');
  console.log('Fixed: ' + p);
});