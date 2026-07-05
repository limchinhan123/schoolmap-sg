import { fetchSchools, fetchDataVintage } from '@/lib/schools'
import AppShell from '@/components/AppShell'

export const revalidate = 3600

export default async function Home() {
  const [schools, vintage] = await Promise.all([fetchSchools(), fetchDataVintage()])
  return <AppShell schools={schools} vintage={vintage} />
}
