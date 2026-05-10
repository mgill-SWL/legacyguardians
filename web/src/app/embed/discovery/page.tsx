import { BookingClient } from "@/app/book/discovery/BookingClient";

export const dynamic = "force-dynamic";

export default function EmbedDiscoveryPage() {
  return <BookingClient embedded typeSlug="discovery-call" />;
}
