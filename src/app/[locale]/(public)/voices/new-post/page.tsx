import { redirect } from 'next/navigation';

export default async function VoicesNewPostRedirect() {
  redirect('/discover/new-post');
}
