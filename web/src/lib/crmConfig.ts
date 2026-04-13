export type CrmAppConfig = {
  defaultSenderName: string;
  bookingUrl?: string;
};

// MVP: env-driven defaults. Campaign-specific overrides live in DB.
export const crmAppConfig: CrmAppConfig = {
  defaultSenderName: process.env.CRM_DEFAULT_SENDER_NAME || 'Noah',
  bookingUrl: process.env.DISCOVERY_BOOKING_URL,
};
