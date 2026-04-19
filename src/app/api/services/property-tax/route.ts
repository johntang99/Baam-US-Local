import { handlePropertyTaxRequest } from '@/lib/property-tax-engine';

export async function GET(request: Request) {
  return handlePropertyTaxRequest(request, 'en');
}
