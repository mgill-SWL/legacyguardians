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

  // MVP packet (ZIP). Today we only have the Joint Trust template wired.
  // This endpoint will grow into the full binder-plan packet.
  const jointTrustTemplateAbsPath = repoTemplatePath("templates/canonical/joint.docx");

  try {
    const { buffer: jointTrustDocx, missingTokens } = renderDocxTemplate({
      templateAbsPath: jointTrustTemplateAbsPath,
      data,
    });

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    // Binder-plan ordering (prefix numbers lock the order in Finder/Explorer).
    zip.file(`01_Joint_Trust_${matterId}.docx`, jointTrustDocx);

    // Placeholders to lock the packet order early.
    // These will be replaced with real generated DOCX once templates are wired.
    const placeholders = [
      "02_Last_Will_and_Testament.docx",
      "03_Advance_Medical_Directive.docx",
      "04_Burial_Power_of_Attorney.docx",
      "05_General_Durable_Power_of_Attorney.docx",
      "06_Certification_of_Trust.docx",
      "07_Assignment_of_Tangible_Personal_Property.docx",
      "08_Declaration_of_Trust.docx",
      "09_Instructions_for_TPP_Distribution.docx",
      "10_Summary_of_Client_Information.docx",
      "11_Summary_of_Estate_Planning_Provisions.docx",
    ];

    for (const name of placeholders) {
      zip.file(name, "(placeholder — template not wired yet)\n");
    }

    const zipBuffer = (await zip.generateAsync({ type: "nodebuffer" })) as unknown as BodyInit;
    const fileName = `LG_Packet_${matterId}.zip`;

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "content-type": "application/zip",
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
