import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "node:fs";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { renderDocxTemplate, repoTemplatePath } from "@/lib/docx/renderTemplate";

type Intake = {
  grantors?: string[];
  hasMinorChildren?: boolean;
};

function renderOrThrow(templateRelFromRepoRoot: string, data: Record<string, unknown>) {
  const templateAbsPath = repoTemplatePath(templateRelFromRepoRoot);
  return { templateAbsPath, ...renderDocxTemplate({ templateAbsPath, data }) };
}

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

  const intake = (matter.intake?.data ?? {}) as Intake;

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

  const rendered: Array<{ name: string; missingTokens: string[]; template: string; bytes: number }> = [];

  try {
    // 01 Joint Trust
    {
      const r = renderOrThrow("templates/canonical/joint.docx", data);
      zip.file(`01_Joint_Trust_${matterId}.docx`, r.buffer);
      rendered.push({ name: "01_Joint_Trust", missingTokens: r.missingTokens, template: r.templateAbsPath, bytes: fs.statSync(r.templateAbsPath).size });
    }

    // 02/03 Wills
    {
      const r = renderOrThrow("templates/canonical/packet_split/will_client1.docx", data);
      zip.file(`02_Last_Will_Client1_${matterId}.docx`, r.buffer);
      rendered.push({ name: "02_Last_Will_Client1", missingTokens: r.missingTokens, template: r.templateAbsPath, bytes: fs.statSync(r.templateAbsPath).size });
    }
    {
      const r = renderOrThrow("templates/canonical/packet_split/will_client2.docx", data);
      zip.file(`03_Last_Will_Client2_${matterId}.docx`, r.buffer);
      rendered.push({ name: "03_Last_Will_Client2", missingTokens: r.missingTokens, template: r.templateAbsPath, bytes: fs.statSync(r.templateAbsPath).size });
    }

    // 04/05 AMD
    {
      const r = renderOrThrow(
        "templates/canonical/packet_split/advance_medical_directive_client1.docx",
        data
      );
      zip.file(`04_Advance_Medical_Directive_Client1_${matterId}.docx`, r.buffer);
      rendered.push({ name: "04_AMD_Client1", missingTokens: r.missingTokens, template: r.templateAbsPath, bytes: fs.statSync(r.templateAbsPath).size });
    }
    {
      const r = renderOrThrow(
        "templates/canonical/packet_split/advance_medical_directive_client2.docx",
        data
      );
      zip.file(`05_Advance_Medical_Directive_Client2_${matterId}.docx`, r.buffer);
      rendered.push({ name: "05_AMD_Client2", missingTokens: r.missingTokens, template: r.templateAbsPath, bytes: fs.statSync(r.templateAbsPath).size });
    }

    // 06/07 Final disposition
    {
      const r = renderOrThrow(
        "templates/canonical/packet_split/final_disposition_client1.docx",
        data
      );
      zip.file(`06_Final_Disposition_Client1_${matterId}.docx`, r.buffer);
      rendered.push({ name: "06_Final_Disposition_Client1", missingTokens: r.missingTokens, template: r.templateAbsPath, bytes: fs.statSync(r.templateAbsPath).size });
    }
    {
      const r = renderOrThrow(
        "templates/canonical/packet_split/final_disposition_client2.docx",
        data
      );
      zip.file(`07_Final_Disposition_Client2_${matterId}.docx`, r.buffer);
      rendered.push({ name: "07_Final_Disposition_Client2", missingTokens: r.missingTokens, template: r.templateAbsPath, bytes: fs.statSync(r.templateAbsPath).size });
    }

    // 08 Optional minors
    if (intake.hasMinorChildren) {
      const r = renderOrThrow(
        "templates/canonical/packet_split/minor_children_poa_and_healthcare.docx",
        data
      );
      zip.file(`08_Minor_Children_Power_of_Attorney_${matterId}.docx`, r.buffer);
      rendered.push({ name: "08_Minor_Children_Power_of_Attorney", missingTokens: r.missingTokens, template: r.templateAbsPath, bytes: fs.statSync(r.templateAbsPath).size });
    }

    const placeholders = [
      "09_General_Durable_Power_of_Attorney.docx",
      "10_Certification_of_Trust.docx",
      "11_Assignment_of_Tangible_Personal_Property.docx",
      "12_Declaration_of_Trust.docx",
      "13_Instructions_for_TPP_Distribution.docx",
      "14_Summary_of_Client_Information.docx",
      "15_Summary_of_Estate_Planning_Provisions.docx",
    ];

    for (const name of placeholders) {
      if (!zip.file(name)) zip.file(name, "(placeholder — template not wired yet)\n");
    }

    zip.file(
      "_manifest.json",
      JSON.stringify(
        {
          matterId,
          deployedAt: new Date().toISOString(),
          build: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
          rendered,
        },
        null,
        2
      )
    );

    const zipBuffer = (await zip.generateAsync({ type: "nodebuffer" })) as unknown as BodyInit;
    const fileName = `LG_Packet_${matterId}.zip`;

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${fileName}"`,
        "x-lg-build": process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
      },
    });
  } catch (e) {
    const err = e as unknown as {
      message?: string;
      properties?: {
        errors?: Array<{ properties?: { explanation?: string; xtag?: string } }>;
      };
    };

    const message = err?.message ?? (e instanceof Error ? e.message : String(e));

    const explanation =
      err?.properties?.errors
        ?.map((x) => x?.properties?.explanation)
        .filter((x): x is string => Boolean(x)) ?? [];
    const tags =
      err?.properties?.errors
        ?.map((x) => x?.properties?.xtag)
        .filter((x): x is string => Boolean(x)) ?? [];

    return NextResponse.json(
      {
        error: "render_failed",
        message,
        build: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        docxtemplater: {
          explanation: explanation.slice(0, 20),
          tags: tags.slice(0, 50),
        },
      },
      { status: 500 }
    );
  }
}
