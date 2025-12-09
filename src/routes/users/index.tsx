import { component$ } from '@builder.io/qwik';
import { Link, routeLoader$ } from '@builder.io/qwik-city';
import { usersService } from '~/services/users.service';
import { Card } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';

export const useUsers = routeLoader$(async () => {
  return await usersService.getAll();
});

export default component$(() => {
  const users = useUsers();

  return (
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Users</h1>
        <Link href="/users/new">
          <Button>Create New User</Button>
        </Link>
      </div>

      {users.value.length === 0 ? (
        <Card>
          <p class="text-gray-500 text-center py-8">No users found. Create your first user to get started.</p>
        </Card>
      ) : (
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.value.map((user) => (
            <Link key={user.id} href={`/users/${user.id}`}>
              <Card hover>
                <h2 class="text-xl font-semibold text-gray-900 mb-2">{user.displayName}</h2>
                <p class="text-gray-600 mb-1">{user.email}</p>
                {(user.city || user.country) && (
                  <p class="text-gray-500 text-sm">
                    {user.city}
                    {user.city && user.country && ', '}
                    {user.country}
                  </p>
                )}
                {user.yearOfBirth && <p class="text-gray-500 text-sm mt-2">Born: {user.yearOfBirth}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
});
