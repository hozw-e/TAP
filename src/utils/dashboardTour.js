/**
 * Guided onboarding tour for the Dashboard page.
 *
 * Extracted from Dashboard.jsx — this builds and starts the intro.js walkthrough.
 * Behavior is identical to the original inline implementation.
 */

import introJs from 'intro.js';
import 'intro.js/introjs.css';

/**
 * Build the HTML for a single tour step card.
 * `description` is "Title|Body" (split on the first '|').
 */
function buildIntro(step, total, description) {
  return `<div class="tour-card">
        <div class="tour-header">
          <span class="tour-title">${description.split('|')[0]}</span>
          <span class="tour-step">${step} of ${total}</span>
        </div>
        <div class="tour-body">${description.split('|')[1]}</div>
        <div class="tour-skip"><a href="javascript:void(0)" class="tour-skip-btn" onclick="document.querySelector('.introjs-skipbutton')?.click()">Skip Tour</a></div>
      </div>`;
}

/** Start the dashboard guided tour. */
export function startDashboardTour() {
  const intro = introJs();
  const totalSteps = 14;

  intro.setOptions({
    steps: [
      { intro: buildIntro(1, totalSteps, 'Welcome to Dashboard!|This is your main control center for monitoring attendance and system activity. Let me show you around!') },
      { element: '.run-analysis-btn', intro: buildIntro(2, totalSteps, 'Run Anomaly Analysis|Scans all active students for behavioral patterns such as chronic tardiness, attendance drop-off, and irregular timing. Findings are saved to each student\'s record.') },
      { element: '.stat-card:nth-child(1)', intro: buildIntro(3, totalSteps, 'Total Students|Shows the total number of students registered in the system.') },
      { element: '.stat-card:nth-child(2)', intro: buildIntro(4, totalSteps, 'Students Present|Displays how many students are currently inside the facility right now.') },
      { element: '.stat-card:nth-child(3)', intro: buildIntro(5, totalSteps, 'Visitors Present|Shows the number of visitors currently checked in at the facility.') },
      { element: '.visit-trend-container', intro: buildIntro(6, totalSteps, 'Visit Trend Graph|Visualizes attendance patterns over time. Use the filter to view All, Students only, or Visitors only.') },
      { element: '.compact-panel:nth-child(1)', intro: buildIntro(7, totalSteps, 'Expected But Absent|Lists students who have a scheduled class today but haven\'t checked in yet. Helps you track attendance gaps in real time.') },
      { element: '.compact-panel:nth-child(2)', intro: buildIntro(8, totalSteps, 'Today\'s Schedules|Shows all courses scheduled for today with their start times. Live classes are highlighted with a pulsing dot, and past classes are dimmed.') },
      { element: '.at-risk-panel', intro: buildIntro(9, totalSteps, 'At-Risk Students|Powered by the anomaly detection engine, this panel flags students showing behavioral patterns like chronic tardiness, attendance drop-off, or irregular timing. Click any alert to go to their record.') },
      { element: '.logs-section', intro: buildIntro(10, totalSteps, 'Attendance Logs|Today\'s real-time attendance records showing Name, Time In, SMS notification status, Time Out, and Out SMS status. Updates automatically when a student taps their NFC card.') },
      { element: '.logs-table', intro: buildIntro(11, totalSteps, 'Logs Table|Each row shows a student or visitor entry. The colored dot indicates student (purple) or visitor (blue). SMS columns show notification status for check-in and check-out.') },
      { element: '.topbar-left', intro: buildIntro(12, totalSteps, 'Connection Status|Shows whether the system is connected to the real-time server. A green dot means live updates are active. If disconnected, click Retry to reconnect.') },
      { element: '.sidebar', intro: buildIntro(13, totalSteps, 'Navigation Menu|Use the sidebar to navigate to Student Records, Attendance Logs, Visitor Logs, Activity Logs, Course Schedules, and the Login Panel.') },
      { element: '.help-float-btn', intro: buildIntro(14, totalSteps, 'Help Button|Click this button anytime to restart this tour and review the dashboard features. That\'s it! You\'re all set!') }
    ],
    showProgress: false,
    showBullets: false,
    showStepNumbers: false,
    exitOnOverlayClick: false,
    doneLabel: 'Done',
    nextLabel: 'Next',
    prevLabel: 'Back',
    skipLabel: 'Skip Tour',
    allowHtml: true,
    tooltipClass: 'custom-tour-tooltip'
  });

  intro.start();
}
