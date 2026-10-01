import { redirect } from 'next/navigation';

// Root route - the panel inbox is the landing page; guards handle anonymous users.
export default function HomePage() {
  redirect('/inbox');
}
