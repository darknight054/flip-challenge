import type { Metadata } from "next";
import { UnfollowedList } from "@/components/unfollowed-list";

export const metadata: Metadata = { title: "Unfollowed" };

export default function UnfollowedPage() {
  return <UnfollowedList />;
}
