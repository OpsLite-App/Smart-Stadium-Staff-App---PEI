import { redirect } from 'next/navigation';


export default function LegacyTaskDetailPage() {
  redirect('/app-routes/tasks');
}
