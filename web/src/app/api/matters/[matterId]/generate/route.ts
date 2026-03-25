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

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  try {
    // 01 Joint Trust
    {
      const templateAbsPath = repoTemplatePath("templates/canonical/joint.docx");
      const { buffer } = renderDocxTemplate({ templateAbsPath, data });
      zip.file(`01_Joint_Trust_${matterId}.docx`, buffer);
    }

    // 02/03 Wills (split templates)
    {
      const templateAbsPath = repoTemplatePath("templates/canonical/packet_split/will_client1.docx");
      const { buffer } = renderDocxTemplate({ templateAbsPath, data });
      zip.file(`02_Last_Will_Client1_${matterId}.docx`, buffer);
    }
    {
      const templateAbsPath = repoTemplatePath("templates/canonical/packet_split/will_client2.docx");
      const { buffer } = renderDocxTemplate({ templateAbsPath, data });
      zip.file(`03_Last_Will_Client2_${matterId}.docx`, buffer);
    }

    // 04/05 AMD + Final Disposition (two docs each)
    {
      const templateAbsPath = repoTemplatePath(
        "templates/canonical/packet_split/advance_medical_directive_client1.docx"
      );
      const { buffer } = renderDocxTemplate({ templateAbsPath, data });
      zip.file(`04_Advance_Medical_Directive_Client1_${matterId}.docx`, buffer);
    }
    {
      const templateAbsPath = repoTemplatePath(
        "templates/canonical/packet_split/advance_medical_directive_client2.docx"
      );
      const { buffer } = renderDocxTemplate({ templateAbsPath, data });
      zip.file(`05_Advance_Medical_Directive_Client2_${matterId}.docx`, buffer);
    }
    {
      const templateAbsPath = repoTemplatePath(
        "templates/canonical/packet_split/final_disposition_client1.docx"
      );
      const { buffer } = renderDocxTemplate({ templateAbsPath, data });
      zip.file(`06_Final_Disposition_Client1_${matterId}.docx`, buffer);
    }
    {
      const templateAbsPath = repoTemplatePath(
        "templates/canonical/packet_split/final_disposition_client2.docx"
      );
      const { buffer } = renderDocxTemplate({ templateAbsPath, data });
      zip.file(`07_Final_Disposition_Client2_${matterId}.docx`, buffer);
    }

    // Placeholders to preserve overall binder-plan ordering.
    const placeholders = [
      "08_General_Durable_Power_of_Attorney.docx",
      "09_Certification_of_Trust.docx",
      "10_Assignment_of_Tangible_Personal_Property.docx",
      "11_Declaration_of_Trust.docx",
      "12_Instructions_for_TPP_Distribution.docx",
      "13_Summary_of_Client_Information.docx",
      "14_Summary_of_Estate_Planning_Provisions.docx",
    ];

    for (const name of placeholders) {
      if (!zip.file(name)) zip.file(name, "(placeholder — template not wired yet)\n");
    }

    const zipBuffer = (await zip.generateAsync({ type: "nodebuffer" })) as unknown as BodyInit;
    const fileName = `LG_Packet_${matterId}.zip`;

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${fileName}"`,
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
