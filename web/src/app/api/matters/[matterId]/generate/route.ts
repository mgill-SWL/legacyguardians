import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import fs from "node:fs";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { renderDocxTemplate, repoTemplatePath } from "@/lib/docx/renderTemplate";


function renderOrThrow(templateRelFromRepoRoot: string, data: Record<string, unknown>) {
  const templateAbsPath = repoTemplatePath(templateRelFromRepoRoot);
  return { templateAbsPath, ...renderDocxTemplate({ templateAbsPath, data }) };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ matterId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email.toLowerCase() } });
  if (!user?.activeFirmId) {
    return NextResponse.json({ error: "Signed-in user has no active firm" }, { status: 400 });
  }

  const { matterId } = await params;
  const matter = await prisma.matter.findFirst({
    where: { id: matterId, firmId: user.activeFirmId },
    include: { intake: true },
  });
  if (!matter) return NextResponse.json({ error: "not found" }, { status: 404 });

  const intake = (matter.intake?.data ?? {}) as unknown as import("@/lib/intakeTypes").IntakeV1;
  const offering = (intake?.offering ?? intake?.matterType ?? "JOINT_TRUST") as
    import("@/lib/intakeTypes").Offering;
  const hasSecondClient = Boolean((intake.grantors?.[1] ?? "").trim());

  const { tokenDataFromIntakeWithOptions } = await import("@/lib/tokenMap");

  const common: Record<string, unknown> = {
    FirmName: "Speedwell Law, PLLC",
    CurrentYear: String(new Date().getFullYear()),
    Offering: offering,
    RECIPROCALTRUSTS: offering === "RECIPROCAL_TRUSTS" ? "YES" : "",
    INDIVIDUALTRUST: offering === "INDIVIDUAL_TRUST" ? "YES" : "",
  };

  const baseData = (opts?: Parameters<typeof tokenDataFromIntakeWithOptions>[1]) =>
    ({
      ...(tokenDataFromIntakeWithOptions(intake, opts) as Record<string, unknown>),
      ...common,
    }) as Record<string, unknown>;

  const { makePlaceholderDocx } = await import("@/lib/docx/placeholderDocx");
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  const rendered: Array<{ name: string; missingTokens: string[]; template: string; bytes: number }> = [];

  try {
    // 01 Trust (offering-dependent)
    if (offering === "JOINT_TRUST") {
      const r = renderOrThrow("templates/canonical/joint.docx", baseData());
      zip.file(`01_Joint_Trust_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "01_Joint_Trust",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    } else if (offering === "INDIVIDUAL_TRUST") {
      const r = renderOrThrow(
        "templates/canonical/individual.docx",
        baseData({ primaryClient: 1 })
      );
      zip.file(`01_Individual_Trust_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "01_Individual_Trust",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    } else if (offering === "RECIPROCAL_TRUSTS") {
      // Generate two individual trusts (one per spouse) and use a reciprocal view
      // so trustee tokens are derived from spouse POV.
      {
        const r = renderOrThrow(
          "templates/canonical/individual.docx",
          baseData({ primaryClient: 1, reciprocalTrustView: true })
        );
        zip.file(`01A_Trust_Spouse1_${matterId}.docx`, r.buffer);
        rendered.push({
          name: "01A_Trust_Spouse1",
          missingTokens: r.missingTokens,
          template: r.templateAbsPath,
          bytes: fs.statSync(r.templateAbsPath).size,
        });
      }
      {
        const r = renderOrThrow(
          "templates/canonical/individual.docx",
          baseData({ primaryClient: 2, reciprocalTrustView: true })
        );
        zip.file(`01B_Trust_Spouse2_${matterId}.docx`, r.buffer);
        rendered.push({
          name: "01B_Trust_Spouse2",
          missingTokens: r.missingTokens,
          template: r.templateAbsPath,
          bytes: fs.statSync(r.templateAbsPath).size,
        });
      }
    } else {
      // No trust doc for WILL_ONLY / WILL_AND_INCAPACITY / INCAPACITY_ONLY (for now)
    }

    // 02/03 Wills
    {
      const r = renderOrThrow("templates/canonical/packet_split/will_client1.docx", baseData());
      zip.file(`02_Last_Will_Client1_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "02_Last_Will_Client1",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    }
    if (hasSecondClient) {
      const r = renderOrThrow("templates/canonical/packet_split/will_client2.docx", baseData());
      zip.file(`03_Last_Will_Client2_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "03_Last_Will_Client2",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    }

    // 04/05 AMD
    {
      const r = renderOrThrow(
        "templates/canonical/packet_split/advance_medical_directive_client1.docx",
        baseData()
      );
      zip.file(`04_Advance_Medical_Directive_Client1_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "04_AMD_Client1",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    }
    if (hasSecondClient) {
      const r = renderOrThrow(
        "templates/canonical/packet_split/advance_medical_directive_client2.docx",
        baseData()
      );
      zip.file(`05_Advance_Medical_Directive_Client2_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "05_AMD_Client2",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    }

    // 06/07 Final disposition
    {
      const r = renderOrThrow(
        "templates/canonical/packet_split/final_disposition_client1.docx",
        baseData()
      );
      zip.file(`06_Final_Disposition_Client1_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "06_Final_Disposition_Client1",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    }
    if (hasSecondClient) {
      const r = renderOrThrow(
        "templates/canonical/packet_split/final_disposition_client2.docx",
        baseData()
      );
      zip.file(`07_Final_Disposition_Client2_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "07_Final_Disposition_Client2",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    }

    // 08 Optional minors
    if (intake.hasMinorChildren) {
      const r = renderOrThrow(
        "templates/canonical/packet_split/minor_children_poa_and_healthcare.docx",
        baseData()
      );
      zip.file(`08_Minor_Children_Power_of_Attorney_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "08_Minor_Children_Power_of_Attorney",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    }

    // 09 Certification of Trust
    {
      const r = renderOrThrow(
        "templates/canonical/packet_split/certification_of_trust.docx",
        baseData()
      );
      zip.file(`09_Certification_of_Trust_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "09_Certification_of_Trust",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    }

    // 10 Assignment of Tangible Personal Property (template is named personal_property)
    {
      const r = renderOrThrow(
        "templates/canonical/packet_split/assignment_of_personal_property.docx",
        baseData()
      );
      zip.file(`10_Assignment_of_Tangible_Personal_Property_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "10_Assignment_of_Tangible_Personal_Property",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    }

    // 11 Declaration of Trust
    {
      const r = renderOrThrow(
        "templates/canonical/packet_split/declaration_of_trust.docx",
        baseData()
      );
      zip.file(`11_Declaration_of_Trust_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "11_Declaration_of_Trust",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    }

    // 12/13 General Durable POA (two files for now; later we can unify or keep separate)
    {
      const r = renderOrThrow(
        "templates/canonical/packet_split/durable_poa_client1.docx",
        baseData()
      );
      zip.file(`12_General_Durable_Power_of_Attorney_Client1_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "12_GDPOA_Client1",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    }
    if (hasSecondClient) {
      const r = renderOrThrow(
        "templates/canonical/packet_split/durable_poa_client2.docx",
        baseData()
      );
      zip.file(`13_General_Durable_Power_of_Attorney_Client2_${matterId}.docx`, r.buffer);
      rendered.push({
        name: "13_GDPOA_Client2",
        missingTokens: r.missingTokens,
        template: r.templateAbsPath,
        bytes: fs.statSync(r.templateAbsPath).size,
      });
    }

    // Remaining placeholders
    const placeholders = [
      "14_Instructions_for_TPP_Distribution.docx",
      "15_Summary_of_Client_Information.docx",
      "16_Summary_of_Estate_Planning_Provisions.docx",
    ];

    for (const name of placeholders) {
      if (!zip.file(name)) {
        zip.file(name, await makePlaceholderDocx("(placeholder — template not wired yet)"));
      }
    }

    // Missing tokens render as blanks inside otherwise clean-looking legal
    // documents, so refuse to hand over the packet unless explicitly forced.
    const docsWithMissingTokens = rendered
      .filter((r) => r.missingTokens.length > 0)
      .map((r) => ({ name: r.name, missingTokens: r.missingTokens }));
    const force = new URL(req.url).searchParams.get("force") === "1";
    if (docsWithMissingTokens.length > 0 && !force) {
      return NextResponse.json(
        {
          error: "missing_tokens",
          message:
            "Some documents have blank fields because intake data is missing. Review the fields below, complete the intake, or download anyway.",
          documentsWithMissingTokens: docsWithMissingTokens,
        },
        { status: 422 }
      );
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
