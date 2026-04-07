import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ username: string }>;
}

export default async function VoiceProfileRedirect({ params }: Props) {
  const { username } = await params;
  redirect(`/discover/voices/${username}`);
}
