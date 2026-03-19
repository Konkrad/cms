import { component$ } from "@builder.io/qwik";
import { Form } from "@builder.io/qwik-city";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { Input } from "~/components/ui/Input";
import { ProfilePictureCropper } from "~/components/profile/ProfilePictureCropper";

export type ProfileStepProps = {
  profile: {
    name: string;
    familyName: string;
    city?: string | null;
    country?: string | null;
    yearOfBirth?: number | null;
    sex?: string | null;
    profilePictureUrl?: string | null;
  };
  updateAction: any;
  onComplete?: () => void;
};

export const ProfileStep = component$<ProfileStepProps>((props) => {
  const action = props.updateAction;

  // When the action is successful, call onComplete if available.
  if (action.value?.success && props.onComplete) {
    props.onComplete();
  }

  return (
    <Card>
      {action.value?.error && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {action.value.error}
        </div>
      )}

      <Form action={action} class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name"
            name="name"
            type="text"
            value={props.profile.name}
            required
          />

          <Input
            label="Last Name"
            name="family_name"
            type="text"
            value={props.profile.familyName}
            required
          />

          <Input
            label="City"
            name="city"
            type="text"
            value={props.profile.city || ""}
          />

          <Input
            label="Country"
            name="country"
            type="text"
            value={props.profile.country || ""}
          />

          <Input
            label="Year of Birth"
            name="year_of_birth"
            type="number"
            value={props.profile.yearOfBirth?.toString() || ""}
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select
              name="sex"
              value={props.profile.sex || ""}
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
        </div>

        <div class="mt-4">
          <ProfilePictureCropper currentPictureUrl={props.profile.profilePictureUrl} />
        </div>

        <div class="flex gap-4 pt-4">
          <Button type="submit" variant="primary">
            Save Profile
          </Button>
        </div>
      </Form>
    </Card>
  );
});
