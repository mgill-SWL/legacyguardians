import { BookingClient } from "@/app/book/discovery/BookingClient";

export const dynamic = "force-dynamic";

export default async function BookByTypePage({ params }: { params: Promise<{ typeSlug: string }> }) {
  const { typeSlug } = await params;
  return <BookingClient typeSlug={typeSlug} />;
}

