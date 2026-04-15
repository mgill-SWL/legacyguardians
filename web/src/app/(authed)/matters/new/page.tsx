import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { NewMatterForm } from "./ui";

export default async function NewMatterPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return <NewMatterForm />;
}
