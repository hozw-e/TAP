-- Migration: Add guardian_email column, remove dependency on messenger_psid/viber_id
-- SMS API PH handles fallback internally (SMS → Email → Push)
-- The guardian_email is stored as an optional field for reference/future use

ALTER TABLE guardians 
ADD COLUMN guardian_email VARCHAR(255) NULL AFTER guardian_cellnum;

-- Note: messenger_psid and viber_id columns are kept for backward compatibility
-- but are no longer actively used or collected in enrollment forms.
