import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { JobCategory, PaymentStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const jobs = await prisma.job.findMany({
      where: { userId },
    });

    // Calculate cumulative totals
    const totalIncome = jobs.reduce((sum, job) => sum + job.totalPrice, 0);
    const totalPaid = jobs.reduce((sum, job) => sum + job.amountPaid, 0);
    const totalPending = totalIncome - totalPaid;

    // Category-wise breakdown
    const byCategory = {
      EDITING: {
        income: jobs
          .filter((j) => j.category === JobCategory.EDITING)
          .reduce((sum, j) => sum + j.totalPrice, 0),
        pending: jobs
          .filter((j) => j.category === JobCategory.EDITING)
          .reduce((sum, j) => sum + j.balanceAmount, 0),
      },
      EXPOSING: {
        income: jobs
          .filter((j) => j.category === JobCategory.EXPOSING)
          .reduce((sum, j) => sum + j.totalPrice, 0),
        pending: jobs
          .filter((j) => j.category === JobCategory.EXPOSING)
          .reduce((sum, j) => sum + j.balanceAmount, 0),
      },
      OTHER: {
        income: jobs
          .filter((j) => j.category === JobCategory.OTHER)
          .reduce((sum, j) => sum + j.totalPrice, 0),
        pending: jobs
          .filter((j) => j.category === JobCategory.OTHER)
          .reduce((sum, j) => sum + j.balanceAmount, 0),
      },
    };

    // Work status counts
    const statusCounts = {
      pending: jobs.filter((j) => j.status === 'PENDING').length,
      inProgress: jobs.filter((j) => j.status === 'IN_PROGRESS').length,
      completed: jobs.filter((j) => j.status === 'COMPLETED').length,
    };

    return NextResponse.json({
      totalIncome,
      totalPaid,
      totalPending,
      byCategory,
      statusCounts,
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary' },
      { status: 500 }
    );
  }
}
