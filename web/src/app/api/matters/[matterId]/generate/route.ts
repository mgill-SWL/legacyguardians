import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { renderDocxTemplate, repoTemplatePath } from "@/lib/docx/renderTemplate";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ matterId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { matterId } = await params;
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    include: { intake: true },
  });
  if (!matter) return NextResponse.json({ error: "not found" }, { status: 404 });

  const intake = (matter.intake?.data ?? {}) as unknown as {
    grantors?: string[];
  };

  const grantors = intake.grantors ?? [];
  const client1 = grantors[0] ?? "";
  const client2 = grantors[1] ?? "";

  const data: Record<string, unknown> = {
    Client1FullName: client1,
    Client2FullName: client2,
    FirmName: "Speedwell Law, PLLC",
  };

  const templateAbsPath = repoTemplatePath("templates/canonical/joint.docx");

  try {
    const { buffer, missingTokens } = renderDocxTemplate({ templateAbsPath, data });

    const fileName = `JointTrust_${matterId}.docx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "content-disposition": `attachment; filename="${fileName}"`,
        "x-lg-missing-tokens": missingTokens.slice(0, 50).join(","),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "render_failed",
        message,
      },
      { status: 500 }
    );
  }
}
