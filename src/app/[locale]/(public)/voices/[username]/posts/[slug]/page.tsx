import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ username: string; slug: string }>;
}

export default async function VoicePostRedirect({ params }: Props) {
  const { username, slug } = await params;
  redirect(`/discover/voices/${username}/posts/${slug}`);
}
