import { fetchSchools } from '@/lib/schools'
import AppShell from '@/components/AppShell'

export const revalidate = 3600

export default async function Home() {
  const schools = await fetchSchools()
  return <AppShell schools={schools} />
}
