import { NextRequest, NextResponse } from 'next/server';
import { getClusters } from '@/lib/pinecone';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;

    const clusters = await getClusters(category);
    return NextResponse.json(clusters);
  } catch (error: any) {
    console.error('Error in GET /api/clusters:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
