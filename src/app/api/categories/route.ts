import { NextRequest, NextResponse } from 'next/server';
import { getCategories } from '@/lib/mongodb';

export async function GET(req: NextRequest) {
  try {
    const categories = await getCategories();
    return NextResponse.json(categories);
  } catch (error: any) {
    console.error('Error in GET /api/categories:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}