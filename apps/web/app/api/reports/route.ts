/**
 * API Route: Reports
 * Fee-based report generation and retrieval
 * 
 * Endpoints:
 * - GET /api/reports?type=class-wise - Class-wise fee report
 * - GET /api/reports?type=student-wise&class=1 - Student-wise fee report
 * - GET /api/reports?type=attendance-fee - Attendance vs fee report
 * - GET /api/reports?type=monthly-collection&month=1&year=2024 - Monthly collection report
 * - GET /api/reports?type=class-fee-status - Class-wise fee status report
 */

import { NextRequest, NextResponse } from 'next/server';
import reportService from '@/lib/reportService';
import { requireAdmin, requireSignedIn } from '@/lib/apiUtils';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    await requireSignedIn(request);

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');

    let report;

    switch (type) {
      case 'class-wise': {
        const classFilter = searchParams.get('class');
        report = await reportService.generateClassWiseFeeReport(
          classFilter ? { class: classFilter } : undefined
        );
        break;
      }

      case 'student-wise': {
        const classFilter = searchParams.get('class');
        report = await reportService.generateStudentWiseFeeReport(
          classFilter ? { class: classFilter } : undefined
        );
        break;
      }

      case 'attendance-fee': {
        const classFilter = searchParams.get('class');
        const minAttendance = searchParams.get('minAttendance');
        const maxAttendance = searchParams.get('maxAttendance');

        report = await reportService.generateAttendanceFeeReport({
          class: classFilter || undefined,
          minAttendance: minAttendance ? parseInt(minAttendance) : undefined,
          maxAttendance: maxAttendance ? parseInt(maxAttendance) : undefined
        });
        break;
      }

      case 'monthly-collection': {
        const month = searchParams.get('month');
        const year = searchParams.get('year');

        if (!month || !year) {
          return NextResponse.json(
            { error: 'Month and year parameters required' },
            { status: 400 }
          );
        }

        await requireAdmin(request);
        report = await reportService.generateMonthlyCollectionReport(
          parseInt(month),
          parseInt(year)
        );
        break;
      }

      case 'class-fee-status': {
        await requireAdmin(request);
        report = await reportService.generateClassWiseFeeStatusReport();
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid report type. Valid types: class-wise, student-wise, attendance-fee, monthly-collection, class-fee-status' },
          { status: 400 }
        );
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error in reports API:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
