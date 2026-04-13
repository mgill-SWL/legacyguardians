import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const campaign = await prisma.crmCampaign.upsert({
    where: { slug: 'rei' },
    update: {
      name: 'Real Estate Investor Webinar',
      defaultSenderName: 'Noah',
    },
    create: {
      slug: 'rei',
      name: 'Real Estate Investor Webinar',
      defaultSenderName: 'Noah',
    },
  });

  const showing = await prisma.crmShowing.create({
    data: {
      campaignId: campaign.id,
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  });

  const contact = await prisma.crmContact.upsert({
    where: { phoneE164: '+15555550100' },
    update: {},
    create: {
      firstName: 'Test',
      lastName: 'Lead',
      phoneE164: '+15555550100',
      email: 'test@example.com',
      state: 'VA',
    },
  });

  await prisma.crmTask.create({
    data: {
      contactId: contact.id,
      campaignId: campaign.id,
      showingId: showing.id,
      type: 'POST_SHOW',
      priority: 'WARM',
      ownerTeam: 'PH',
      dueAt: new Date(Date.now() - 5 * 60 * 1000),
      notes: 'Seeded task',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
