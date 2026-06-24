/**
 * Web Worker for Heavy Computations
 * Offloads data processing to background thread
 */

/**
 * Calculate attendance statistics
 */
function calculateAttendanceStats(records) {
  const stats = {
    totalRecords: records.length,
    present: 0,
    absent: 0,
    late: 0,
    onLeave: 0,
    byClass: {},
    byDate: {}
  };

  records.forEach((record) => {
    // Count by status
    if (record.status === 'present') stats.present++;
    if (record.status === 'absent') stats.absent++;
    if (record.status === 'late') stats.late++;
    if (record.status === 'leave') stats.onLeave++;

    // Count by class
    if (record.class) {
      if (!stats.byClass[record.class]) {
        stats.byClass[record.class] = { total: 0, present: 0, absent: 0 };
      }
      stats.byClass[record.class].total++;
      if (record.status === 'present' || record.status === 'late') {
        stats.byClass[record.class].present++;
      } else if (record.status === 'absent') {
        stats.byClass[record.class].absent++;
      }
    }

    // Count by date
    if (record.date) {
      if (!stats.byDate[record.date]) {
        stats.byDate[record.date] = { total: 0, present: 0 };
      }
      stats.byDate[record.date].total++;
      if (record.status === 'present' || record.status === 'late') {
        stats.byDate[record.date].present++;
      }
    }
  });

  // Calculate percentages
  Object.keys(stats.byClass).forEach((className) => {
    const classStats = stats.byClass[className];
    classStats.percentage = Math.round((classStats.present / classStats.total) * 100);
  });

  return stats;
}

/**
 * Calculate salary statistics
 */
function calculateSalaryStats(records) {
  const stats = {
    totalRecords: records.length,
    totalSalary: 0,
    totalPaid: 0,
    totalPending: 0,
    byTeacher: {},
    byMonth: {}
  };

  records.forEach((record) => {
    stats.totalSalary += record.salary || 0;
    stats.totalPaid += record.paid || 0;
    stats.totalPending += (record.salary || 0) - (record.paid || 0);

    // By teacher
    if (record.teacherId) {
      if (!stats.byTeacher[record.teacherId]) {
        stats.byTeacher[record.teacherId] = {
          name: record.teacherName || '',
          salary: 0,
          paid: 0,
          pending: 0
        };
      }
      stats.byTeacher[record.teacherId].salary += record.salary || 0;
      stats.byTeacher[record.teacherId].paid += record.paid || 0;
      stats.byTeacher[record.teacherId].pending += (record.salary || 0) - (record.paid || 0);
    }

    // By month
    if (record.month) {
      if (!stats.byMonth[record.month]) {
        stats.byMonth[record.month] = { salary: 0, paid: 0, pending: 0 };
      }
      stats.byMonth[record.month].salary += record.salary || 0;
      stats.byMonth[record.month].paid += record.paid || 0;
      stats.byMonth[record.month].pending += (record.salary || 0) - (record.paid || 0);
    }
  });

  return stats;
}

/**
 * Calculate fee statistics
 */
function calculateFeeStats(records) {
  const stats = {
    totalRecords: records.length,
    totalFees: 0,
    totalCollected: 0,
    totalPending: 0,
    byClass: {},
    byStudent: {}
  };

  records.forEach((record) => {
    stats.totalFees += record.totalFee || 0;
    stats.totalCollected += record.collected || 0;
    stats.totalPending += (record.totalFee || 0) - (record.collected || 0);

    // By class
    if (record.class) {
      if (!stats.byClass[record.class]) {
        stats.byClass[record.class] = { total: 0, collected: 0, pending: 0 };
      }
      stats.byClass[record.class].total += record.totalFee || 0;
      stats.byClass[record.class].collected += record.collected || 0;
      stats.byClass[record.class].pending += (record.totalFee || 0) - (record.collected || 0);
    }

    // By student
    if (record.studentId) {
      if (!stats.byStudent[record.studentId]) {
        stats.byStudent[record.studentId] = {
          name: record.studentName || '',
          total: 0,
          collected: 0,
          pending: 0
        };
      }
      stats.byStudent[record.studentId].total += record.totalFee || 0;
      stats.byStudent[record.studentId].collected += record.collected || 0;
      stats.byStudent[record.studentId].pending += (record.totalFee || 0) - (record.collected || 0);
    }
  });

  return stats;
}

/**
 * Filter and sort records
 */
function filterAndSort(records, filters, sortBy) {
  let result = [...records];

  // Apply filters
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        result = result.filter((record) => {
          if (Array.isArray(value)) {
            return value.includes(record[key]);
          }
          return record[key] === value || String(record[key]).includes(String(value));
        });
      }
    });
  }

  // Apply sorting
  if (sortBy) {
    result.sort((a, b) => {
      const aVal = a[sortBy.field];
      const bVal = b[sortBy.field];

      if (aVal < bVal) return sortBy.order === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortBy.order === 'asc' ? 1 : -1;
      return 0;
    });
  }

  return result;
}

/**
 * Message handler for web worker
 */
self.onmessage = (event) => {
  const { type, payload } = event.data;
  let result;

  try {
    switch (type) {
      case 'CALCULATE_ATTENDANCE_STATS':
        result = calculateAttendanceStats(payload);
        break;
      case 'CALCULATE_SALARY_STATS':
        result = calculateSalaryStats(payload);
        break;
      case 'CALCULATE_FEE_STATS':
        result = calculateFeeStats(payload);
        break;
      case 'FILTER_AND_SORT':
        result = filterAndSort(payload.records, payload.filters, payload.sortBy);
        break;
      default:
        result = { error: `Unknown message type: ${type}` };
    }

    self.postMessage({
      type: 'SUCCESS',
      originalType: type,
      result
    });
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      originalType: type,
      error: error.message
    });
  }
};
