import { redirect } from 'next/navigation';

// Root route - the panel inbox is the landing page; guards handle anonymous users.
// Pet webhook/health remain under /api/* and are not affected by this redirect.
export default function HomePage() {
  redirect('/inbox');
}
