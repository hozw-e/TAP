/**
 * Pure presentation/formatting helpers for the Dashboard page.
 *
 * These are stateless utilities extracted from Dashboard.jsx so the page
 * component focuses on orchestration. Behavior is identical to the originals.
 */

/** Format a "HH:MM[:SS]" time string as "h:MM AM/PM", or "---" if invalid. */
export function formatTime(timeStr) {
  if (!timeStr) return '---';
  try {
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '---';
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch {
    return '---';
  }
}

/** Format a schedule time "HH:MM" as "h:MM AM/PM", or "" if empty. */
export function formatScheduleTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** True if the given end time (today) is already in the past. */
export function isSchedulePast(endTime) {
  if (!endTime) return false;
  const now = new Date();
  const [h, m] = endTime.split(':').map(Number);
  const endDate = new Date();
  endDate.setHours(h, m, 0, 0);
  return now > endDate;
}

/** True if now falls within [startTime, endTime] today. */
export function isScheduleOngoing(startTime, endTime) {
  if (!startTime || !endTime) return false;
  const now = new Date();
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const start = new Date();
  start.setHours(sh, sm, 0, 0);
  const end = new Date();
  end.setHours(eh, em, 0, 0);
  return now >= start && now <= end;
}

/** Human-readable duration between two "HH:MM:SS" times, or "---". */
export function calculateDuration(timeIn, timeOut) {
  if (!timeIn || !timeOut) return '---';
  try {
    const toSec = (t) => {
      const [h, m, s] = t.split(':').map(Number);
      return h * 3600 + m * 60 + (s || 0);
    };
    const diff = toSec(timeOut) - toSec(timeIn);
    if (diff < 0) return '---';
    return `${Math.floor(diff / 3600)} hrs ${Math.floor((diff % 3600) / 60)} mins`;
  } catch {
    return '---';
  }
}

/** Check-in SMS status label for a log row: 'SMS' | 'FAILED' | 'N/A'. */
export function getNotificationStatus(log) {
  if (log.row_type === 'visitor') return 'N/A';
  if (log.msg_channel && log.msg_success === 1) return 'SMS';
  if (log.msg_success === 0) return 'FAILED';
  return 'N/A';
}

/** Check-out SMS status: 'SMS' | 'FAILED' | 'N/A' | null (no checkout yet). */
export function getOutNotificationStatus(log) {
  if (log.row_type === 'visitor') return 'N/A';
  if (!log.time_out) return null; // no checkout yet — render '---'
  if (log.msg_out_channel && log.msg_out_success === 1) return 'SMS';
  if (log.msg_out_success === 0) return 'FAILED';
  return 'N/A';
}

/** Overall row status: 'VISITOR' | 'NO TIME OUT' | 'PRESENT' | 'LEFT'. */
export function getStatus(log) {
  if (log.row_type === 'visitor') return 'VISITOR';
  if (log.auto_closed) return 'NO TIME OUT';
  if (!log.time_out) {
    const today = new Date().toISOString().split('T')[0];
    if (log.date && log.date < today) return 'NO TIME OUT';
    return 'PRESENT';
  }
  return 'LEFT';
}

/**
 * Build the page-number list for pagination, with '...' gaps.
 * @param {number} currentPage
 * @param {number} totalPages
 * @returns {Array<number|string>}
 */
export function getPageNumbers(currentPage, totalPages) {
  const pages = [];
  const maxVisiblePages = 5;

  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    if (currentPage <= 3) {
      for (let i = 1; i <= 4; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    }
  }
  return pages;
}
