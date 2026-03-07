import { component$ } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";

interface Member {
  id: string;
  name: string;
  familyName: string;
  loginId?: string;
  joinedAt?: string;
  isRepresentative: boolean;
}

interface MemberListProps {
  members: Member[];
  promoteAction?: any;
}

export const MemberList = component$<MemberListProps>(
  ({ members, promoteAction }) => {
    if (members.length === 0) {
      return (
        <div class="bg-white rounded-lg shadow p-8 text-center">
          <p class="text-gray-600">No members to display.</p>
        </div>
      );
    }

    return (
      <div class="bg-white rounded-lg shadow overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              {promoteAction && (
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {members.map((member) => (
              <tr key={member.id}>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">
                    {member.name} {member.familyName}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-500">
                    {member.loginId || "N/A"}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-500">
                    {member.joinedAt
                      ? new Date(member.joinedAt).toLocaleDateString()
                      : "N/A"}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  {member.isRepresentative ? (
                    <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      ⭐ Representative
                    </span>
                  ) : (
                    <span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                      Member
                    </span>
                  )}
                </td>
                {promoteAction && (
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    {!member.isRepresentative && (
                      <Form action={promoteAction}>
                        <input type="hidden" name="userId" value={member.id} />
                        <button
                          type="submit"
                          class="text-blue-600 hover:text-blue-900 font-medium disabled:opacity-50"
                          disabled={promoteAction.isRunning}
                        >
                          Promote
                        </button>
                      </Form>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
);
