import { permanentRedirect } from "next/navigation";

// The birthday planner was discontinued: birthday activities live in their category.
export default function BirthdaysPage() {
  permanentRedirect("/c/birthdays-parties");
}
