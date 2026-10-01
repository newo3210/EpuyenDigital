import type { Metadata } from 'next';
import { getCurrentOperator } from '@/features/auth/server';
import { esAR } from '@/i18n/es-AR';
import { avatarPublicUrl } from '@/infrastructure/storage/avatar-url';
import { AvatarUploader } from '@/presentation/profile/avatar-uploader';
import { ProfileNameForm } from '@/presentation/profile/profile-name-form';

export const metadata: Metadata = { title: esAR.profile.title };

const sectionClasses = 'flex flex-col gap-4 rounded-xl border border-line bg-surface p-6';

// Profile settings page - own display name and avatar.
export default async function ProfileSettingsPage() {
  const operator = await getCurrentOperator();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{esAR.profile.title}</h1>
        <p className="mt-1 text-sm text-muted">{esAR.profile.subtitle}</p>
      </header>

      <section aria-labelledby="profile-avatar-heading" className={sectionClasses}>
        <h2 id="profile-avatar-heading" className="text-lg font-semibold">
          {esAR.profile.avatarSection}
        </h2>
        <AvatarUploader fullName={operator.fullName} avatarUrl={avatarPublicUrl(operator.avatarPath)} />
      </section>

      <section aria-labelledby="profile-name-heading" className={sectionClasses}>
        <h2 id="profile-name-heading" className="text-lg font-semibold">
          {esAR.profile.nameSection}
        </h2>
        <ProfileNameForm fullName={operator.fullName} />
      </section>
    </div>
  );
}
