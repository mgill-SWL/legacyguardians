import { BookingClient } from "./BookingClient";

export const dynamic = "force-dynamic";

export default function BookDiscoveryPage() {
  return <BookingClient typeSlug="discovery-call" />;
}
